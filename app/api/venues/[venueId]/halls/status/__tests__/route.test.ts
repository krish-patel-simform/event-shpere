import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { venueService } from "@/src/features/venues/server";
import {
  giftCity,
  hallIds,
  venueId,
} from "@/src/features/venues/__fixtures__/venues";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../../__fixtures__/route-test";
import { PATCH } from "../route";

jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
  readRefreshTokenCookie: jest.fn(),
  clearAuthCookies: jest.fn(),
  writeAuthCookies: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  ...jest.requireActual("@/src/core/auth/server/auth-session"),
  resolveCurrentUser: jest.fn(),
}));
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
// The service's rules (inactive venue, busy halls) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  venueService: { setHallsStatus: jest.fn() },
}));
const service = jest.mocked(venueService);

const PATH = `/api/venues/${venueId}/halls/status`;
const params = { venueId };
const hallManager = userWith([PERMISSION.HALL_MANAGE]);
const allOn = {
  ...giftCity,
  halls: giftCity.halls.map((hall) => ({ ...hall, isActive: true })),
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(PATCH, "PATCH", PATH, { params, body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(hallManager);
  service.setHallsStatus.mockResolvedValue(allOn);
});
afterEach(() => jest.restoreAllMocks());

describe("PATCH /api/venues/[venueId]/halls/status", () => {
  it("turns every hall on: 200 with the venue and its halls", async () => {
    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: allOn });
    expect(service.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      halls: "all",
    });
  });

  it("hands the service the listed halls only", async () => {
    await send({ isActive: false, halls: [hallIds.main, hallIds.lounge] });

    expect(service.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: false,
      halls: [hallIds.main, hallIds.lounge],
    });
  });

  it.each([
    ["no halls", { isActive: true }],
    ["an empty hall list", { isActive: true, halls: [] }],
    ["a hall id that is not a uuid", { isActive: true, halls: ["nope"] }],
    [
      "the same hall twice",
      { isActive: true, halls: [hallIds.main, hallIds.main] },
    ],
    ["halls as an unknown word", { isActive: true, halls: "some" }],
    ["no isActive", { halls: "all" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.setHallsStatus).not.toHaveBeenCalled();
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", "/api/venues/nope/halls/status", {
      params: { venueId: "nope" },
      body: { isActive: true, halls: "all" },
    });

    expect(res.status).toBe(400);
    expect(service.setHallsStatus).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(401);
    expect(service.setHallsStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["an organizer", users.organizer],
    ["a caller with only VENUE_MANAGE", userWith([PERMISSION.VENUE_MANAGE])],
  ])("refuses %s without HALL_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(403);
    expect(service.setHallsStatus).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { isActive: true, halls: "all" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.setHallsStatus).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown venue", async () => {
    service.setHallsStatus.mockRejectedValue(
      new NotFoundError("Venue not found"),
    );

    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 VENUE_INACTIVE with its code", async () => {
    service.setHallsStatus.mockRejectedValue(
      new ConflictError(
        "VENUE_INACTIVE",
        "Activate the venue before its halls",
      ),
    );

    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("VENUE_INACTIVE");
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ isActive: true, halls: "all" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.setHallsStatus).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", hallManager.id);
  });
});
