import { assertRateLimit } from "@/src/core/http/rate-limit";
import type { MyTicketDto } from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../__fixtures__/route-test";
import { GET } from "../route";

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
// Which tickets are listed (upcoming/past, ordering) is the service's rule, tested there.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { listMyRegistrations: jest.fn() },
}));
const service = jest.mocked(registrationService);

const PATH = "/api/me/registrations";
const EVENT_ID = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

const ticket: MyTicketDto = {
  registration: {
    id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
    eventId: EVENT_ID,
    status: "registered",
    ticketCode: "ESEVT1Y6D4S",
    amount: 0,
    currency: "INR",
    reason: "free",
    registeredAt: "2026-11-02T10:00:00.000Z",
  },
  event: {
    id: EVENT_ID,
    slug: "product-engineering-summit-2026",
    title: "Product Engineering Summit 2026",
    status: "published",
    startAt: "2026-12-03T03:30:00.000Z",
    endAt: "2026-12-05T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    registrationClosesAt: null,
    venueName: "Convention Centre",
    venueCity: "Pune",
  },
  bookedSessionCount: 2,
};
const meta = { page: 1, pageSize: 10, total: 1 };

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.user);
  service.listMyRegistrations.mockResolvedValue({ items: [ticket], meta });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/me/registrations", () => {
  it("answers one page of the caller's tickets, with the ticket codes", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [ticket], meta });
  });

  it("tells every cache not to keep it (it carries ticket codes)", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("hands the service the defaults (upcoming, all statuses) and the caller", async () => {
    await call(GET, "GET", PATH);

    expect(service.listMyRegistrations).toHaveBeenCalledWith(
      { page: 1, pageSize: 10, status: "all", when: "upcoming" },
      users.user,
    );
  });

  it("hands the service the parsed query, and never a user id from the request", async () => {
    await call(GET, "GET", PATH, {
      query: {
        page: "2",
        pageSize: "5",
        status: "cancelled",
        when: "past",
        userId: users.speaker.id,
      },
    });

    expect(service.listMyRegistrations).toHaveBeenCalledWith(
      { page: 2, pageSize: 5, status: "cancelled", when: "past" },
      users.user,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.listMyRegistrations).not.toHaveBeenCalled();
  });

  it("refuses a caller without REGISTRATION_VIEW_OWN (403): an organizer has no tickets", async () => {
    signInAs(users.organizer);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.listMyRegistrations).not.toHaveBeenCalled();
  });

  it("needs only REGISTRATION_VIEW_OWN", async () => {
    signInAs(userWith(["REGISTRATION_VIEW_OWN"]));

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
  });

  it.each([
    ["page 0", { page: "0" }],
    ["a page size over 50", { pageSize: "51" }],
    ["an unknown status", { status: "pending" }],
    ["an unknown time filter", { when: "tomorrow" }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listMyRegistrations).not.toHaveBeenCalled();
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH);

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.user.id);
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.listMyRegistrations).not.toHaveBeenCalled();
  });

  it("never answers a ticket that breaks the contract (500, nothing leaked)", async () => {
    service.listMyRegistrations.mockResolvedValue({
      items: [{ ...ticket, registration: { ...ticket.registration, id: "x" } }],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("ESEVT1Y6D4S");
  });
});
