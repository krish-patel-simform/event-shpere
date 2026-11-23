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
} from "../../../__fixtures__/route-test";
import { DELETE, GET, PATCH } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (what a guest sees, unique names, never-used venues) have their own tests.
jest.mock("@/src/features/venues/server", () => ({
  venueService: {
    getVenueDetail: jest.fn(),
    updateVenue: jest.fn(),
    deleteVenue: jest.fn(),
  },
}));
const service = jest.mocked(venueService);

const PATH = `/api/venues/${venueId}`;
const params = { venueId };
const venueManager = userWith([PERMISSION.VENUE_MANAGE]);
const badParams = { venueId: "not-a-uuid" };
const BAD_PATH = "/api/venues/not-a-uuid";

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/venues/[venueId]", () => {
  beforeEach(() => service.getVenueDetail.mockResolvedValue(giftCity));

  it("answers a guest the venue with its halls, which no cache may keep", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: giftCity });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service without the manage view for a guest", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getVenueDetail).toHaveBeenCalledWith(venueId, {
      canManage: false,
    });
  });

  it("gives a caller with VENUE_MANAGE the manage view", async () => {
    signInAs(venueManager);

    await call(GET, "GET", PATH, { params });

    expect(service.getVenueDetail).toHaveBeenCalledWith(venueId, {
      canManage: true,
    });
  });

  it("refuses a venue id that is not a uuid (400) without asking the service", async () => {
    const res = await call(GET, "GET", BAD_PATH, { params: badParams });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getVenueDetail).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (unknown, or inactive for a guest)", async () => {
    service.getVenueDetail.mockRejectedValue(
      new NotFoundError("Venue not found"),
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
    expect(service.getVenueDetail).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/venues/[venueId]", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(PATCH, "PATCH", PATH, { params, body: sent, headers });

  beforeEach(() => {
    signInAs(venueManager);
    service.updateVenue.mockResolvedValue(giftCity);
  });

  it("saves the change: 200 with the venue and its halls", async () => {
    const res = await send({ name: "GIFT City Convention Centre" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: giftCity });
  });

  it("hands the service only the fields sent, parsed", async () => {
    await send({ city: " Ahmedabad ", country: "in", postalCode: null });

    expect(service.updateVenue).toHaveBeenCalledWith(venueId, {
      city: "Ahmedabad",
      country: "IN",
      postalCode: null,
    });
  });

  it("lets both coordinates be cleared together", async () => {
    await send({ latitude: null, longitude: null });

    expect(service.updateVenue).toHaveBeenCalledWith(venueId, {
      latitude: null,
      longitude: null,
    });
  });

  it.each([
    ["an empty body", {}],
    ["only a latitude", { latitude: 23.1 }],
    ["one coordinate cleared and one set", { latitude: null, longitude: 72 }],
    ["a blank name", { name: " " }],
    ["an unknown time zone", { timezone: "Nowhere/City" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateVenue).not.toHaveBeenCalled();
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", BAD_PATH, {
      params: badParams,
      body: { name: "X" },
    });

    expect(res.status).toBe(400);
    expect(service.updateVenue).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ name: "X" });

    expect(res.status).toBe(401);
    expect(service.updateVenue).not.toHaveBeenCalled();
  });

  it.each([
    ["an organizer", users.organizer],
    ["a caller with only HALL_MANAGE", userWith([PERMISSION.HALL_MANAGE])],
  ])("refuses %s without VENUE_MANAGE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send({ name: "X" });

    expect(res.status).toBe(403);
    expect(service.updateVenue).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send({ name: "X" }, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.updateVenue).not.toHaveBeenCalled();
  });

  it("passes on a 409 VENUE_EXISTS with its code", async () => {
    service.updateVenue.mockRejectedValue(
      new ConflictError("VENUE_EXISTS", "That name is taken in this city"),
    );

    const res = await send({ name: "Taken" });

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("VENUE_EXISTS");
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ name: "X" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.updateVenue).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", venueManager.id);
  });
});

describe("DELETE /api/venues/[venueId]", () => {
  const send = (headers?: Record<string, string>) =>
    call(DELETE, "DELETE", PATH, { params, headers });

  beforeEach(() => {
    signInAs(venueManager);
    service.deleteVenue.mockResolvedValue(undefined);
  });

  it("deletes the venue: 204 with an empty body", async () => {
    const res = await send();

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.deleteVenue).toHaveBeenCalledWith(venueId);
  });

  it("refuses a venue id that is not a uuid (400)", async () => {
    const res = await call(DELETE, "DELETE", BAD_PATH, { params: badParams });

    expect(res.status).toBe(400);
    expect(service.deleteVenue).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.deleteVenue).not.toHaveBeenCalled();
  });

  it("refuses an organizer without VENUE_MANAGE (403)", async () => {
    signInAs(users.organizer);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.deleteVenue).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before deleting anything", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.deleteVenue).not.toHaveBeenCalled();
  });

  it("passes on a 409 VENUE_IN_USE when events or sessions use the venue", async () => {
    service.deleteVenue.mockRejectedValue(
      new ConflictError(
        "VENUE_IN_USE",
        "This venue has events or sessions, so it cannot be deleted. Deactivate it instead",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "VENUE_IN_USE",
        message:
          "This venue has events or sessions, so it cannot be deleted. Deactivate it instead",
      },
    });
  });

  it("passes on the service's 404 for an unknown venue", async () => {
    service.deleteVenue.mockRejectedValue(new NotFoundError("Venue not found"));

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.deleteVenue).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", venueManager.id);
  });
});
