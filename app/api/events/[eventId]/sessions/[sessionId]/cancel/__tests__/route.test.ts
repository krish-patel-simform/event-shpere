import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/src/core/http";
import {
  EVENT_ID,
  talk,
} from "@/src/features/sessions/__fixtures__/organizer-sessions";
import { sessionService } from "@/src/features/sessions/server";
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
// The service's rules (ownership, seats cancelled with it, ended sessions) have their own tests.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { cancelSession: jest.fn() },
}));
const service = jest.mocked(sessionService);

const SESSION_ID = talk.id;
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/cancel`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };
const cancelled = { ...talk, status: "cancelled" as const };

const send = (headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { params, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.cancelSession.mockResolvedValue(cancelled);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/events/[eventId]/sessions/[sessionId]/cancel", () => {
  it("cancels the session: 200 with the cancelled session", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: cancelled });
    expect(service.cancelSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.organizer,
    );
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.cancelSession).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.cancelSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 EVENT_READ_ONLY for an admin", async () => {
    signInAs(users.admin);
    service.cancelSession.mockRejectedValue(
      new ForbiddenError(
        "Admins can view this event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(POST, "POST", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.cancelSession).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before the service", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.cancelSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a session of another event)", async () => {
    service.cancelSession.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code (the session has ended)", async () => {
    service.cancelSession.mockRejectedValue(
      new ConflictError("SESSION_ENDED", "This session has already ended"),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("SESSION_ENDED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.cancelSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
