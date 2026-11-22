import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { SessionCheckInDto } from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../../../__fixtures__/route-test";
import { POST } from "../route";

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
// The service's rules (who, the event door first, the time window) have their own tests.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { checkInToSession: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/check-ins`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const checkIn: SessionCheckInDto = {
  id: "0a1b2c3d-4e5f-4a6b-8c7d-000000000002",
  sessionId: SESSION_ID,
  checkedInAt: "2026-12-04T05:02:00.000Z",
  method: "manual",
  attendee: { firstName: "Priya", lastName: "Shah", ticketCode: "ESEVT1Y6D4S" },
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { params, body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.checkInToSession.mockResolvedValue(checkIn);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/sessions/[sessionId]/check-ins", () => {
  it("checks the code in at the session door: 201 with who walked in", async () => {
    const res = await send({ ticketCode: " esevt1y6d4s " });

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: checkIn });
    // Only the code, trimmed and upper-cased: no day at a session door.
    expect(service.checkInToSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      { ticketCode: "ESEVT1Y6D4S" },
      users.organizer,
    );
  });

  it("drops a day sent by mistake: the session's own day applies", async () => {
    await send({ ticketCode: "A1", attendanceDate: "2026-12-04" });

    expect(service.checkInToSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      { ticketCode: "A1" },
      users.organizer,
    );
  });

  it("lets an admin check in too (the service decides who reaches which event)", async () => {
    signInAs(users.admin);

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(201);
    expect(service.checkInToSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      expect.anything(),
      users.admin,
    );
  });

  it.each([
    ["no code", {}],
    ["a blank code", { ticketCode: "  " }],
    ["a code that is too long", { ticketCode: "A".repeat(33) }],
    ["a code that is not text", { ticketCode: 123 }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.checkInToSession).not.toHaveBeenCalled();
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(POST, "POST", PATH, {
      params: bad,
      body: { ticketCode: "A1" },
    });

    expect(res.status).toBe(400);
    expect(service.checkInToSession).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(401);
    expect(service.checkInToSession).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { ticketCode: "A1" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.checkInToSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (an unknown code, or another organizer's event)", async () => {
    service.checkInToSession.mockRejectedValue(
      new NotFoundError("Ticket not found"),
    );

    const res = await send({ ticketCode: "NOPE" });

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code and details (who is already checked in)", async () => {
    const details = {
      attendee: checkIn.attendee,
      checkedInAt: checkIn.checkedInAt,
    };
    service.checkInToSession.mockRejectedValue(
      new ConflictError(
        "ALREADY_CHECKED_IN",
        "Priya Shah is already checked in to this session",
        details,
      ),
    );

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "ALREADY_CHECKED_IN",
        message: "Priya Shah is already checked in to this session",
        details,
      },
    });
  });

  it("passes on a 409 without details (no seat in this session)", async () => {
    service.checkInToSession.mockRejectedValue(
      new ConflictError(
        "SESSION_NOT_BOOKED",
        "Priya Shah has no seat in this session",
      ),
    );

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "SESSION_NOT_BOOKED",
        message: "Priya Shah has no seat in this session",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.checkInToSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });

  it("never answers a service result that breaks the contract (500, nothing leaked)", async () => {
    service.checkInToSession.mockResolvedValue({
      ...checkIn,
      attendee: { ...checkIn.attendee, email: "priya@example.com" },
      id: "not-a-uuid",
    } as never);

    const res = await send({ ticketCode: "A1" });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("priya@example.com");
  });
});
