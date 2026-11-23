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
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (unique hall names, inactive venue) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  venueService: { addHall: jest.fn() },
}));
const service = jest.mocked(venueService);

const PATH = `/api/venues/${venueId}/halls`;
const params = { venueId };
const hallManager = userWith([PERMISSION.HALL_MANAGE]);
const withNewHall = {
  ...giftCity,
  halls: [
    ...giftCity.halls,
    {
      id: "d0000000-0000-4000-8000-000000000004",
      name: "Board Room",
      capacity: 12,
      sortOrder: 3,
      isActive: true,
    },
  ],
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { params, body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(hallManager);
  service.addHall.mockResolvedValue(withNewHall);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/venues/[venueId]/halls", () => {
  it("adds the hall: 201 with the venue and its updated halls", async () => {
    const res = await send({ name: "Board Room", capacity: 12 });

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: withNewHall });
  });

  it("hands the service the venue and the trimmed hall", async () => {
    await send({ name: "  Board Room ", capacity: 12, sortOrder: 0 });

    expect(service.addHall).toHaveBeenCalledWith(venueId, {
      name: "Board Room",
      capacity: 12,
    });
  });

  it.each([
    ["no name", { capacity: 12 }],
    ["a blank name", { name: "  ", capacity: 12 }],
    ["0 seats", { name: "Board Room", capacity: 0 }],
    ["a fraction of a seat", { name: "Board Room", capacity: 12.5 }],
    ["seats as text", { name: "Board Room", capacity: "12" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.addHall).not.toHaveBeenCalled();
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/venues/nope/halls", {
      params: { venueId: "nope" },
      body: { name: "Board Room", capacity: 12 },
    });

    expect(res.status).toBe(400);
    expect(service.addHall).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ name: "Board Room", capacity: 12 });

    expect(res.status).toBe(401);
    expect(service.addHall).not.toHaveBeenCalled();
  });

  it.each([
    ["an organizer", users.organizer],
    ["a caller with only VENUE_MANAGE", userWith([PERMISSION.VENUE_MANAGE])],
  ])("refuses %s without HALL_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send({ name: "Board Room", capacity: 12 });

    expect(res.status).toBe(403);
    expect(service.addHall).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { name: "Board Room", capacity: 12 },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.addHall).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown venue", async () => {
    service.addHall.mockRejectedValue(new NotFoundError("Venue not found"));

    const res = await send({ name: "Board Room", capacity: 12 });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 HALL_EXISTS with its code", async () => {
    service.addHall.mockRejectedValue(
      new ConflictError("HALL_EXISTS", "This venue already has that hall"),
    );

    const res = await send({ name: "Main Auditorium", capacity: 12 });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "HALL_EXISTS",
        message: "This venue already has that hall",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ name: "Board Room", capacity: 12 });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.addHall).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", hallManager.id);
  });
});
