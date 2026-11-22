import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError } from "@/src/core/http";
import type { EventDto, PublicEventListItemDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import {
  FINTECH_ID,
  SAMPLE_VENUES,
} from "@/src/features/events/__fixtures__/event-manage";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../__fixtures__/route-test";
import { GET, POST } from "../route";

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
// The service's rules (published only, who may create, daily limit) have their own tests.
jest.mock("@/src/features/events/server", () => ({
  eventService: { listPublicEvents: jest.fn(), createEvent: jest.fn() },
}));
const service = jest.mocked(eventService);

const PATH = "/api/events";

const card: PublicEventListItemDto = {
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venue: { name: "Hotel Orchid", city: "Pune", state: "Maharashtra" },
  ticketPrice: 0,
  seatsLeft: 250,
  tagline: "Where payments meet product",
  coverImage: null,
};

const draft: EventDto = {
  id: FINTECH_ID,
  slug: "fintech-product-forum",
  title: "Fintech Product Forum",
  status: "draft",
  startAt: "2030-12-12T04:00:00.000Z",
  endAt: "2030-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: SAMPLE_VENUES[2].id,
  capacity: 250,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  publishedAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events", () => {
  const meta = { page: 1, pageSize: 12, total: 1 };

  beforeEach(() => {
    signInAs(null);
    service.listPublicEvents.mockResolvedValue({ items: [card], meta });
  });

  it("answers a guest a page of published events that a CDN may keep briefly", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [card], meta });
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
  });

  it("hands the service the defaults when no query is sent", async () => {
    await call(GET, "GET", PATH);

    expect(service.listPublicEvents).toHaveBeenCalledWith({
      page: 1,
      pageSize: 12,
      when: "upcoming",
      sort: "soonest",
    });
  });

  it("hands the service the parsed query: numbers, a trimmed search and the filters", async () => {
    await call(GET, "GET", PATH, {
      query: {
        page: "2",
        pageSize: "24",
        search: "  fintech ",
        price: "free",
        when: "past",
        sort: "price_asc",
      },
    });

    expect(service.listPublicEvents).toHaveBeenCalledWith({
      page: 2,
      pageSize: 24,
      search: "fintech",
      price: "free",
      when: "past",
      sort: "price_asc",
    });
  });

  it.each([
    ["a page below 1", { page: "0" }],
    ["a page size above 50", { pageSize: "51" }],
    ["an unknown price filter", { price: "cheap" }],
    ["an unknown time filter", { when: "tomorrow" }],
    ["an unknown sort", { sort: "random" }],
    ["a search over 100 characters", { search: "x".repeat(101) }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listPublicEvents).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first forwarded address) against the public read limit", async () => {
    await call(GET, "GET", PATH, {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
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
    expect(service.listPublicEvents).not.toHaveBeenCalled();
  });

  it("never answers a card that breaks the contract (500)", async () => {
    service.listPublicEvents.mockResolvedValue({
      items: [{ ...card, ticketPrice: -1 }],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
    expect((await body(res)).error?.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/events", () => {
  const valid = {
    title: "  Fintech Product Forum ",
    startAt: "2030-12-12T09:30:00+05:30",
    endAt: "2030-12-12T17:30:00+05:30",
  };
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { body: sent, headers });

  beforeEach(() => service.createEvent.mockResolvedValue(draft));

  it("creates the draft: 201 with the event", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: draft });
  });

  it("hands the service the parsed body (trimmed title, Dates, default price and currency) and the caller", async () => {
    await send({ ...valid, currency: "usd", capacity: 250 });

    expect(service.createEvent).toHaveBeenCalledWith(
      {
        title: "Fintech Product Forum",
        startAt: new Date("2030-12-12T04:00:00.000Z"),
        endAt: new Date("2030-12-12T12:00:00.000Z"),
        capacity: 250,
        ticketPrice: 0,
        currency: "USD",
      },
      users.organizer,
    );
  });

  it.each([
    ["a title under 3 characters", { ...valid, title: "AI" }],
    [
      "a start in the past",
      {
        ...valid,
        startAt: "2020-01-01T09:00:00+05:30",
        endAt: "2020-01-01T10:00:00+05:30",
      },
    ],
    [
      "an end before the start",
      { ...valid, endAt: "2030-12-12T08:00:00+05:30" },
    ],
    ["a date without an offset", { ...valid, startAt: "2030-12-12T09:30:00" }],
    ["a venue id that is not a uuid", { ...valid, venueId: "hall-1" }],
    ["a capacity of 0", { ...valid, capacity: 0 }],
    ["a negative price", { ...valid, ticketPrice: -100 }],
    [
      "registration closing after the event starts",
      { ...valid, registrationClosesAt: "2030-12-13T09:00:00+05:30" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.createEvent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(valid);

    expect(res.status).toBe(401);
    expect(service.createEvent).not.toHaveBeenCalled();
  });

  it("refuses a user without EVENT_CREATE (403)", async () => {
    signInAs(users.user);

    const res = await send(valid);

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.createEvent).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.createEvent).not.toHaveBeenCalled();
  });

  it("passes on the service's 409 with its code (an inactive venue)", async () => {
    service.createEvent.mockRejectedValue(
      new ConflictError("VENUE_INACTIVE", "This venue is no longer available"),
    );

    const res = await send(valid);

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("VENUE_INACTIVE");
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(service.createEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
