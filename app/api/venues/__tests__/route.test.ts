import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { venueService } from "@/src/features/venues/server";
import { LIST_VENUES } from "@/src/features/venues/__fixtures__/venue-list";
import { giftCity } from "@/src/features/venues/__fixtures__/venues";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../__fixtures__/route-test";
import { GET, POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (guests see active venues only, unique names) have their own tests: faked here.
jest.mock("@/src/features/venues/server", () => ({
  venueService: { listVenues: jest.fn(), createVenue: jest.fn() },
}));
const service = jest.mocked(venueService);

const PATH = "/api/venues";
const venueManager = userWith([PERMISSION.VENUE_MANAGE]);

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/venues", () => {
  const items = LIST_VENUES.slice(0, 2);
  const meta = { page: 1, pageSize: 10, total: 2 };

  beforeEach(() => service.listVenues.mockResolvedValue({ items, meta }));

  it("answers a guest a page of venues that no cache may keep", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: items, meta });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service with the default paging and sort, without the manage view, for a guest", async () => {
    await call(GET, "GET", PATH);

    expect(service.listVenues).toHaveBeenCalledWith(
      { page: 1, pageSize: 10, sort: "name" },
      { canManage: false },
    );
  });

  it("hands the service the parsed query", async () => {
    await call(GET, "GET", PATH, {
      query: {
        page: "2",
        pageSize: "25",
        search: "  gift ",
        status: "inactive",
        state: " Gujarat ",
        sort: "halls",
      },
    });

    expect(service.listVenues).toHaveBeenCalledWith(
      {
        page: 2,
        pageSize: 25,
        search: "gift",
        status: "inactive",
        state: "Gujarat",
        sort: "halls",
      },
      { canManage: false },
    );
  });

  it("gives a caller with VENUE_MANAGE the manage view (retired venues too)", async () => {
    signInAs(venueManager);

    await call(GET, "GET", PATH);

    expect(service.listVenues).toHaveBeenCalledWith(expect.anything(), {
      canManage: true,
    });
  });

  it("does not give an organizer the manage view", async () => {
    signInAs(users.organizer);

    await call(GET, "GET", PATH);

    expect(service.listVenues).toHaveBeenCalledWith(expect.anything(), {
      canManage: false,
    });
  });

  it.each([
    ["an unknown status", { status: "retired" }],
    ["an unknown sort", { sort: "random" }],
    ["a page size above 50", { pageSize: "51" }],
    ["a page that is not a number", { page: "first" }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listVenues).not.toHaveBeenCalled();
  });

  it("counts a guest against the public read limit by IP", async () => {
    await call(GET, "GET", PATH, {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.listVenues).not.toHaveBeenCalled();
  });

  it("never answers a venue that breaks the contract (500)", async () => {
    service.listVenues.mockResolvedValue({
      items: [{ ...items[0], hallCount: -1 }],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/venues", () => {
  const valid = {
    name: " GIFT City Convention Centre ",
    addressLine: "Block 12, Zone 1, GIFT City",
    city: "Gandhinagar",
    state: "gujarat",
    halls: [
      { name: "Main Auditorium", capacity: 300 },
      { name: "Workshop Room 1", capacity: 80 },
    ],
  };
  const createdVenue = {
    ...giftCity,
    createdAt: "2026-10-01T09:00:00.000Z",
  };
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { body: sent, headers });

  beforeEach(() => {
    signInAs(venueManager);
    service.createVenue.mockResolvedValue(createdVenue);
  });

  it("creates the venue with its halls: 201 with the new venue", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: createdVenue });
  });

  it("hands the service the parsed body (trimmed, with the default country and time zone) and the caller", async () => {
    await send(valid);

    expect(service.createVenue).toHaveBeenCalledWith(
      {
        name: "GIFT City Convention Centre",
        addressLine: "Block 12, Zone 1, GIFT City",
        city: "Gandhinagar",
        state: "gujarat",
        country: "IN",
        timezone: "Asia/Kolkata",
        halls: [
          { name: "Main Auditorium", capacity: 300 },
          { name: "Workshop Room 1", capacity: 80 },
        ],
      },
      venueManager,
    );
  });

  it("upper-cases the country and keeps a full map pin", async () => {
    await send({ ...valid, country: "us", latitude: 40.7, longitude: -74 });

    expect(service.createVenue).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "US",
        latitude: 40.7,
        longitude: -74,
      }),
      venueManager,
    );
  });

  it.each([
    ["no halls", { ...valid, halls: [] }],
    [
      "two halls with the same name (ignoring case)",
      {
        ...valid,
        halls: [
          { name: "Main", capacity: 10 },
          { name: " main ", capacity: 20 },
        ],
      },
    ],
    ["a hall with 0 seats", { ...valid, halls: [{ name: "A", capacity: 0 }] }],
    ["a latitude without a longitude", { ...valid, latitude: 23.1 }],
    ["an unknown time zone", { ...valid, timezone: "Mars/Olympus" }],
    ["a 3-letter country", { ...valid, country: "IND" }],
    ["no name", { ...valid, name: "  " }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.createVenue).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON (400)", async () => {
    const res = await call(POST, "POST", PATH, {
      formData: new FormData(),
    });

    expect(res.status).toBe(400);
    expect(service.createVenue).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(valid);

    expect(res.status).toBe(401);
    expect(service.createVenue).not.toHaveBeenCalled();
  });

  it.each([
    ["a user", users.user],
    ["an organizer", users.organizer],
    ["a caller with only HALL_MANAGE", userWith([PERMISSION.HALL_MANAGE])],
  ])("refuses %s without VENUE_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send(valid);

    expect(res.status).toBe(403);
    expect(service.createVenue).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.createVenue).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for a state name that is no state", async () => {
    service.createVenue.mockRejectedValue(new NotFoundError("State not found"));

    const res = await send(valid);

    expect(res.status).toBe(404);
  });

  it("passes on a 409 VENUE_EXISTS with its code", async () => {
    service.createVenue.mockRejectedValue(
      new ConflictError(
        "VENUE_EXISTS",
        "A venue with this name already exists in Gandhinagar",
      ),
    );

    const res = await send(valid);

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "VENUE_EXISTS",
        message: "A venue with this name already exists in Gandhinagar",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.createVenue).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", venueManager.id);
  });
});
