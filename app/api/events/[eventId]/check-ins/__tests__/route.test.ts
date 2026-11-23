import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../__fixtures__/route-test";
import { GET, POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (who, which day, which window) have their own tests: here it is faked.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { listCheckIns: jest.fn(), checkInAttendee: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const PATH = `/api/events/${EVENT_ID}/check-ins`;
const params = { eventId: EVENT_ID };

const checkIn = {
  id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000001",
  registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-000000000001",
  attendanceDate: "2026-12-04",
  checkedInAt: "2026-12-04T04:11:00.000Z",
  method: "manual" as const,
  attendee: { firstName: "Priya", lastName: "Shah", ticketCode: "ESEVT1Y6D4S" },
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/check-ins", () => {
  beforeEach(() => {
    service.listCheckIns.mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { checkedIn: 0, registered: 0 },
      },
    });
  });

  it("answers a page of the log, private to the caller (names and emails)", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({
      data: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        counts: { checkedIn: 0, registered: 0 },
      },
    });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("hands the service the event, the parsed query and the caller", async () => {
    await call(GET, "GET", PATH, {
      params,
      query: { page: "2", search: "priya", sort: "name" },
    });

    expect(service.listCheckIns).toHaveBeenCalledWith(
      EVENT_ID,
      expect.objectContaining({ page: 2, search: "priya", sort: "name" }),
      users.organizer,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.listCheckIns).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/nope/check-ins", {
      params: { eventId: "nope" },
    });

    expect(res.status).toBe(400);
    expect(service.listCheckIns).not.toHaveBeenCalled();
  });

  it("refuses a bad query (400): an unknown sort", async () => {
    const res = await call(GET, "GET", PATH, {
      params,
      query: { sort: "random" },
    });

    expect(res.status).toBe(400);
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });
});

describe("POST /api/events/[eventId]/check-ins", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, body: sent, headers });

  beforeEach(() => service.checkInAttendee.mockResolvedValue(checkIn));

  it("checks the code in for the day sent: 201 with who walked in", async () => {
    const res = await send({
      ticketCode: " esevt1y6d4s ",
      attendanceDate: "2026-12-04",
    });

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: checkIn });
    // The code is trimmed and upper-cased before the service sees it.
    expect(service.checkInAttendee).toHaveBeenCalledWith(
      EVENT_ID,
      { ticketCode: "ESEVT1Y6D4S", attendanceDate: "2026-12-04" },
      users.organizer,
    );
  });

  it("lets an admin check in too (the service decides who reaches which event)", async () => {
    signInAs(users.admin);

    const res = await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(res.status).toBe(201);
    expect(service.checkInAttendee).toHaveBeenCalledWith(
      EVENT_ID,
      expect.anything(),
      users.admin,
    );
  });

  it.each([
    ["no code", { attendanceDate: "2026-12-04" }],
    ["a blank code", { ticketCode: "  ", attendanceDate: "2026-12-04" }],
    ["no day", { ticketCode: "A1" }],
    [
      "a day that is not a date",
      { ticketCode: "A1", attendanceDate: "Friday" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.checkInAttendee).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(res.status).toBe(401);
    expect(service.checkInAttendee).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { ticketCode: "A1", attendanceDate: "2026-12-04" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.checkInAttendee).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (an unknown code, or another organizer's event)", async () => {
    service.checkInAttendee.mockRejectedValue(
      new NotFoundError("Ticket not found"),
    );

    const res = await send({
      ticketCode: "NOPE",
      attendanceDate: "2026-12-04",
    });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code and details (who is already checked in)", async () => {
    const details = {
      attendee: checkIn.attendee,
      checkedInAt: checkIn.checkedInAt,
    };
    service.checkInAttendee.mockRejectedValue(
      new ConflictError(
        "ALREADY_CHECKED_IN",
        "Priya Shah is already checked in today",
        details,
      ),
    );

    const res = await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "ALREADY_CHECKED_IN",
        message: "Priya Shah is already checked in today",
        details,
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.checkInAttendee).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });

  it("never answers a service result that breaks the contract (500, nothing leaked)", async () => {
    service.checkInAttendee.mockResolvedValue({
      ...checkIn,
      attendee: { ...checkIn.attendee, email: "priya@example.com" },
      id: "not-a-uuid",
    } as never);

    const res = await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("priya@example.com");
  });
});
