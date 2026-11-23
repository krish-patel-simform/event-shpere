import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { HallDetailDto } from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";
import {
  giftCity,
  hallIds,
  mainAuditorium,
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
import { DELETE, GET, PATCH } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (what a guest sees, hall in use, last hall) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  venueService: {
    getHallDetail: jest.fn(),
    updateHall: jest.fn(),
    deleteHall: jest.fn(),
  },
}));
const service = jest.mocked(venueService);

const HALL_ID = hallIds.main;
const PATH = `/api/venues/${venueId}/halls/${HALL_ID}`;
const params = { venueId, hallId: HALL_ID };
const hallManager = userWith([PERMISSION.HALL_MANAGE]);

const hall: HallDetailDto = {
  ...mainAuditorium,
  createdAt: "2026-10-01T09:00:00.000Z",
  venue: {
    id: venueId,
    name: giftCity.name,
    city: giftCity.city,
    isActive: true,
  },
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/venues/[venueId]/halls/[hallId]", () => {
  beforeEach(() => service.getHallDetail.mockResolvedValue(hall));

  it("answers a guest the hall with its venue summary, which no cache may keep", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: hall });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service without the manage view for a guest", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getHallDetail).toHaveBeenCalledWith(venueId, HALL_ID, {
      canManage: false,
    });
  });

  it("gives a caller with HALL_MANAGE the manage view", async () => {
    signInAs(hallManager);

    await call(GET, "GET", PATH, { params });

    expect(service.getHallDetail).toHaveBeenCalledWith(venueId, HALL_ID, {
      canManage: true,
    });
  });

  it.each([
    ["venue", { venueId: "nope", hallId: HALL_ID }],
    ["hall", { venueId, hallId: "nope" }],
  ])(
    "refuses a %s id that is not a uuid (400) without asking the service",
    async (_name, badParams) => {
      const res = await call(
        GET,
        "GET",
        `/api/venues/${badParams.venueId}/halls/${badParams.hallId}`,
        { params: badParams },
      );

      expect(res.status).toBe(400);
      expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
      expect(service.getHallDetail).not.toHaveBeenCalled();
    },
  );

  it("passes on the service's 404 (unknown, or inactive for a guest)", async () => {
    service.getHallDetail.mockRejectedValue(
      new NotFoundError("Hall not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
  });

  it("counts a guest against the public read limit by IP", async () => {
    await call(GET, "GET", PATH, {
      params,
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.getHallDetail).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/venues/[venueId]/halls/[hallId]", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(PATCH, "PATCH", PATH, { params, body: sent, headers });

  beforeEach(() => {
    signInAs(hallManager);
    service.updateHall.mockResolvedValue(giftCity);
  });

  it("saves the change: 200 with the venue and its halls", async () => {
    const res = await send({ capacity: 320 });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: giftCity });
  });

  it("hands the service only the fields sent, trimmed", async () => {
    await send({ name: " Grand Hall " });

    expect(service.updateHall).toHaveBeenCalledWith(venueId, HALL_ID, {
      name: "Grand Hall",
    });
  });

  it.each([
    ["an empty body", {}],
    ["0 seats", { capacity: 0 }],
    ["a blank name", { name: "  " }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateHall).not.toHaveBeenCalled();
  });

  it("refuses a hall id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", `/api/venues/${venueId}/halls/x`, {
      params: { venueId, hallId: "x" },
      body: { capacity: 10 },
    });

    expect(res.status).toBe(400);
    expect(service.updateHall).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ capacity: 10 });

    expect(res.status).toBe(401);
    expect(service.updateHall).not.toHaveBeenCalled();
  });

  it.each([
    ["an organizer", users.organizer],
    ["a caller with only VENUE_MANAGE", userWith([PERMISSION.VENUE_MANAGE])],
  ])("refuses %s without HALL_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send({ capacity: 10 });

    expect(res.status).toBe(403);
    expect(service.updateHall).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { capacity: 10 },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.updateHall).not.toHaveBeenCalled();
  });

  it("passes on a 409 HALL_HAS_SESSIONS with its code", async () => {
    service.updateHall.mockRejectedValue(
      new ConflictError(
        "HALL_HAS_SESSIONS",
        "Sessions that are not over use this hall: Keynote",
      ),
    );

    const res = await send({ capacity: 10 });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "HALL_HAS_SESSIONS",
        message: "Sessions that are not over use this hall: Keynote",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ capacity: 10 });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.updateHall).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", hallManager.id);
  });
});

describe("DELETE /api/venues/[venueId]/halls/[hallId]", () => {
  const remaining = {
    ...giftCity,
    halls: giftCity.halls.filter((h) => h.id !== HALL_ID),
  };
  const send = (headers?: Record<string, string>) =>
    call(DELETE, "DELETE", PATH, { params, headers });

  beforeEach(() => {
    signInAs(hallManager);
    service.deleteHall.mockResolvedValue(remaining);
  });

  it("deletes the hall: 200 with the venue and its remaining halls", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: remaining });
    expect(service.deleteHall).toHaveBeenCalledWith(venueId, HALL_ID);
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(DELETE, "DELETE", `/api/venues/x/halls/${HALL_ID}`, {
      params: { venueId: "x", hallId: HALL_ID },
    });

    expect(res.status).toBe(400);
    expect(service.deleteHall).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.deleteHall).not.toHaveBeenCalled();
  });

  it("refuses an organizer without HALL_MANAGE (403)", async () => {
    signInAs(users.organizer);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.deleteHall).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before deleting anything", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.deleteHall).not.toHaveBeenCalled();
  });

  it.each([
    ["LAST_HALL", "A venue must keep at least one hall"],
    [
      "HALL_IN_USE",
      "Sessions are scheduled in this hall. Deactivate it instead of deleting it",
    ],
  ])("passes on a 409 %s with its message", async (code, message) => {
    service.deleteHall.mockRejectedValue(new ConflictError(code, message));

    const res = await send();

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: { code, message } });
  });

  it("passes on the service's 404 for an unknown hall", async () => {
    service.deleteHall.mockRejectedValue(new NotFoundError("Hall not found"));

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.deleteHall).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", hallManager.id);
  });
});
