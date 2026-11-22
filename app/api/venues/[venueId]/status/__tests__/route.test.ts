import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { venueService } from "@/src/features/venues/server";
import { giftCity, venueId } from "@/src/features/venues/__fixtures__/venues";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
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
// The service's rules (halls follow the venue, busy halls) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  venueService: { setVenueStatus: jest.fn() },
}));
const service = jest.mocked(venueService);

const PATH = `/api/venues/${venueId}/status`;
const params = { venueId };
const venueManager = userWith([PERMISSION.VENUE_MANAGE]);
const inactive = {
  ...giftCity,
  isActive: false,
  halls: giftCity.halls.map((hall) => ({ ...hall, isActive: false })),
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(PATCH, "PATCH", PATH, { params, body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(venueManager);
  service.setVenueStatus.mockResolvedValue(inactive);
});
afterEach(() => jest.restoreAllMocks());

describe("PATCH /api/venues/[venueId]/status", () => {
  it("deactivates the venue: 200 with the venue and its halls", async () => {
    const res = await send({ isActive: false });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: inactive });
  });

  it("activates no hall unless asked (activateHalls defaults to none)", async () => {
    await send({ isActive: true });

    expect(service.setVenueStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      activateHalls: "none",
    });
  });

  it("hands the service activateHalls all when asked", async () => {
    await send({ isActive: true, activateHalls: "all" });

    expect(service.setVenueStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      activateHalls: "all",
    });
  });

  it.each([
    ["no isActive", {}],
    ["isActive as text", { isActive: "false" }],
    ["an unknown activateHalls", { isActive: true, activateHalls: "some" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.setVenueStatus).not.toHaveBeenCalled();
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", "/api/venues/nope/status", {
      params: { venueId: "nope" },
      body: { isActive: false },
    });

    expect(res.status).toBe(400);
    expect(service.setVenueStatus).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ isActive: false });

    expect(res.status).toBe(401);
    expect(service.setVenueStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["an organizer", users.organizer],
    ["a caller with only HALL_MANAGE", userWith([PERMISSION.HALL_MANAGE])],
  ])("refuses %s without VENUE_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send({ isActive: false });

    expect(res.status).toBe(403);
    expect(service.setVenueStatus).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { isActive: false },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.setVenueStatus).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown venue", async () => {
    service.setVenueStatus.mockRejectedValue(
      new NotFoundError("Venue not found"),
    );

    const res = await send({ isActive: false });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 VENUE_HAS_SESSIONS with the busy halls", async () => {
    const details = { halls: [{ id: giftCity.halls[0].id, sessions: 2 }] };
    service.setVenueStatus.mockRejectedValue(
      new ConflictError(
        "VENUE_HAS_SESSIONS",
        "This venue cannot be deactivated.",
        details,
      ),
    );

    const res = await send({ isActive: false });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "VENUE_HAS_SESSIONS",
        message: "This venue cannot be deactivated.",
        details,
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ isActive: false });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.setVenueStatus).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", venueManager.id);
  });
});
