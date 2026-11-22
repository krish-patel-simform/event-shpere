import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import type {
  SessionAttendeeDto,
  SessionAttendeeListMeta,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../../__fixtures__/route-test";
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
// Who may see which event's list is the service's rule (it has its own tests): here it is faked.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { listSessionAttendees: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/attendees`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const seat: SessionAttendeeDto = {
  bookingId: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
  firstName: "Priya",
  lastName: "Shah",
  email: "priya@example.com",
  ticketCode: "ESEVT7K3Q9P",
  status: "registered",
  bookedAt: "2026-11-02T10:00:00.000Z",
  checkedInAt: null,
};

const meta: SessionAttendeeListMeta = {
  page: 1,
  pageSize: 10,
  total: 1,
  counts: { registered: 1, cancelled: 0, checkedIn: 0, pending: 1 },
  checkInOpensHoursBefore: 2,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.listSessionAttendees.mockResolvedValue({ items: [seat], meta });
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/sessions/[sessionId]/attendees", () => {
  it("answers a page of seats with the whole session's counts, private to the caller", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [seat], meta });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("hands the service the ids, the query with its defaults and the caller", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.listSessionAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
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

  it("hands the service the parsed query (numbers, trimmed search)", async () => {
    await call(GET, "GET", PATH, {
      params,
      query: {
        page: "2",
        pageSize: "25",
        checkedIn: "no",
        sort: "name",
        search: "  priya ",
      },
    });

    expect(service.listSessionAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      expect.objectContaining({
        page: 2,
        pageSize: 25,
        checkedIn: "no",
        sort: "name",
        search: "priya",
      }),
      users.organizer,
    );
  });

  it("lets any signed-in caller through: the service decides (a plain user gets its 404)", async () => {
    signInAs(users.user);
    service.listSessionAttendees.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect(service.listSessionAttendees).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      expect.anything(),
      users.user,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.listSessionAttendees).not.toHaveBeenCalled();
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(GET, "GET", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listSessionAttendees).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown sort", { sort: "random" }],
    ["a page size over 50", { pageSize: "51" }],
    ["page 0", { page: "0" }],
    ["an unknown check-in filter", { checkedIn: "maybe" }],
  ])("refuses %s (400)", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { params, query });

    expect(res.status).toBe(400);
    expect(service.listSessionAttendees).not.toHaveBeenCalled();
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });

  it("never answers a page that breaks the contract (500, nothing leaked)", async () => {
    service.listSessionAttendees.mockResolvedValue({
      items: [{ ...seat, bookingId: "not-a-uuid", passwordHash: "secret" }],
      meta,
    } as never);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("priya@example.com");
  });
});
