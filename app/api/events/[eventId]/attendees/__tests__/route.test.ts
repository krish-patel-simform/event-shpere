import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import type {
  AttendeeDto,
  AttendeeListMeta,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../__fixtures__/route-test";
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
// Who reaches which event's list (own events, or any for an admin) is the service's rule.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { listAttendees: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const PATH = `/api/events/${EVENT_ID}/attendees`;
const params = { eventId: EVENT_ID };

const priya: AttendeeDto = {
  registrationId: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
  firstName: "Priya",
  lastName: "Shah",
  email: "priya@example.com",
  ticketCode: "ESEVT7K3Q9P",
  status: "registered",
  registeredAt: "2026-11-01T08:00:00.000Z",
  checkedInAt: "2026-12-12T03:30:00.000Z",
  checkedInBy: { firstName: "Omkar", lastName: "Patil" },
  checkInMethod: "manual",
};

const meta: AttendeeListMeta = {
  page: 1,
  pageSize: 10,
  total: 1,
  counts: { registered: 1, cancelled: 0, checkedIn: 1, pending: 0 },
  checkInOpensHoursBefore: 6,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.listAttendees.mockResolvedValue({ items: [priya], meta });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/attendees", () => {
  it("answers a page of attendees that no cache may keep (names, emails, ticket codes)", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [priya], meta });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("hands the service the defaults when no query is sent, and the caller", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.listAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      {
        page: 1,
        pageSize: 10,
        status: "all",
        checkedIn: "all",
        sort: "newest",
      },
      users.organizer,
    );
  });

  it("hands the service the parsed query: numbers, a trimmed search, the day and the filters", async () => {
    await call(GET, "GET", PATH, {
      params,
      query: {
        page: "3",
        pageSize: "50",
        status: "registered",
        checkedIn: "no",
        date: "2026-12-12",
        sort: "name",
        search: "  priya ",
      },
    });

    expect(service.listAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      {
        page: 3,
        pageSize: 50,
        status: "registered",
        checkedIn: "no",
        date: "2026-12-12",
        sort: "name",
        search: "priya",
      },
      users.organizer,
    );
  });

  it("lets an admin through to the service (it decides which events they reach)", async () => {
    signInAs(users.admin);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(service.listAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      expect.anything(),
      users.admin,
    );
  });

  it.each([
    ["a page size above 50", { pageSize: "51" }],
    ["an unknown status", { status: "pending" }],
    ["an unknown checked-in filter", { checkedIn: "maybe" }],
    ["a day that is not YYYY-MM-DD", { date: "12/12/2026" }],
    ["an unknown sort", { sort: "random" }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { params, query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listAttendees).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/nope/attendees", {
      params: { eventId: "nope" },
    });

    expect(res.status).toBe(400);
    expect(service.listAttendees).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.listAttendees).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (another organizer's event)", async () => {
    service.listAttendees.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts the caller against the read limit, and answers 429 when it is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(429);
    expect(service.listAttendees).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });

  it("never answers meta that breaks the contract (500)", async () => {
    service.listAttendees.mockResolvedValue({
      items: [priya],
      meta: { ...meta, checkInOpensHoursBefore: 0 },
    });

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
  });
});
