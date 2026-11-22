import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import type { SessionBookingDto } from "@/src/features/registrations";
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
// The booking rules (event registration first, seats, start time) have their own tests.
jest.mock("@/src/features/registrations/server", () => ({
  registrationService: { bookSession: jest.fn() },
}));
const service = jest.mocked(registrationService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/registrations`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const booking: SessionBookingDto = {
  id: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
  sessionId: SESSION_ID,
  status: "registered",
  registeredAt: "2026-11-02T10:00:00.000Z",
};

const send = (
  options: { body?: unknown; headers?: Record<string, string> } = {},
) => call(POST, "POST", PATH, { params, ...options });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.user);
  service.bookSession.mockResolvedValue(booking);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/sessions/[sessionId]/registrations", () => {
  it("books a seat for the signed-in user: 201 with the booking", async () => {
    const res = await send();

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: booking });
    expect(service.bookSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.user,
    );
  });

  it("ignores a body: the seat is always the caller's", async () => {
    await send({ body: { userId: users.speaker.id } });

    expect(service.bookSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.user,
    );
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.bookSession).not.toHaveBeenCalled();
  });

  it("refuses a caller without REGISTRATION_CREATE (403): an organizer", async () => {
    signInAs(users.organizer);

    const res = await send();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.bookSession).not.toHaveBeenCalled();
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(POST, "POST", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.bookSession).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await send({ headers: { origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(service.bookSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a draft session or one of another event)", async () => {
    service.bookSession.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code (no event registration yet)", async () => {
    service.bookSession.mockRejectedValue(
      new ConflictError(
        "EVENT_REGISTRATION_REQUIRED",
        "Register for the event first",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "EVENT_REGISTRATION_REQUIRED",
        message: "Register for the event first",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.bookSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.user.id);
  });
});
