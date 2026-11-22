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
} from "../../../../../__fixtures__/route-test";
import { GET, PATCH } from "../route";

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
// The service's rules (ownership, merged-session checks, hall clashes) have their own tests.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { getSession: jest.fn(), updateSession: jest.fn() },
}));
const service = jest.mocked(sessionService);

const SESSION_ID = talk.id;
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/sessions/[sessionId]", () => {
  beforeEach(() => service.getSession.mockResolvedValue(talk));

  it("answers the session for the edit form", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: talk });
    expect(service.getSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.organizer,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getSession).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect(service.getSession).not.toHaveBeenCalled();
  });

  it.each([
    ["event", { eventId: "nope", sessionId: SESSION_ID }],
    ["session", { eventId: EVENT_ID, sessionId: "nope" }],
  ])("refuses a %s id that is not a uuid (400)", async (_name, bad) => {
    const res = await call(GET, "GET", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a session of another event)", async () => {
    service.getSession.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });
});

describe("PATCH /api/events/[eventId]/sessions/[sessionId]", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(PATCH, "PATCH", PATH, { params, body: sent, headers });

  beforeEach(() => service.updateSession.mockResolvedValue(talk));

  it("saves the change: 200 with the updated session", async () => {
    const res = await send({ title: "Offline-first Event Apps" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: talk });
  });

  it("hands the service only the fields sent, parsed (dates as Date, null clears)", async () => {
    await send({
      title: "  Moved talk ",
      startAt: "2026-12-12T11:00:00+05:30",
      endAt: "2026-12-12T12:00:00+05:30",
      onlineUrl: null,
    });

    expect(service.updateSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      {
        title: "Moved talk",
        startAt: new Date("2026-12-12T05:30:00.000Z"),
        endAt: new Date("2026-12-12T06:30:00.000Z"),
        onlineUrl: null,
      },
      users.organizer,
    );
  });

  it.each([
    ["an empty body", {}],
    ["only unknown fields", { status: "scheduled" }],
    ["a title that is too short", { title: "ab" }],
    ["a join link that is not https", { onlineUrl: "http://meet.example.com" }],
    ["a negative price", { price: -1 }],
    ["a hall id that is not a uuid", { hallId: "hall-a" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateSession).not.toHaveBeenCalled();
  });

  it("refuses a session id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", PATH, {
      params: { eventId: EVENT_ID, sessionId: "nope" },
      body: { title: "A real title" },
    });

    expect(res.status).toBe(400);
    expect(service.updateSession).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ title: "A real title" });

    expect(res.status).toBe(401);
    expect(service.updateSession).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send({ title: "A real title" });

    expect(res.status).toBe(403);
    expect(service.updateSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 EVENT_READ_ONLY for an admin (may view, not change)", async () => {
    signInAs(users.admin);
    service.updateSession.mockRejectedValue(
      new ForbiddenError(
        "Admins can view this event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send({ title: "A real title" });

    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({
      error: {
        code: "EVENT_READ_ONLY",
        message: "Admins can view this event but not change it",
      },
    });
    expect(service.updateSession).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      { title: "A real title" },
      users.admin,
    );
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { title: "A real title" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.updateSession).not.toHaveBeenCalled();
  });

  it("passes on a 409 with its code (the new slot's hall is taken)", async () => {
    service.updateSession.mockRejectedValue(
      new ConflictError("HALL_BUSY", "Hall A is booked at that time"),
    );

    const res = await send({ startAt: "2026-12-12T11:00:00+05:30" });

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("HALL_BUSY");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ title: "A real title" });

    expect(res.status).toBe(429);
    expect(service.updateSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });

  it("never answers a service result that breaks the contract (500)", async () => {
    service.updateSession.mockResolvedValue({
      ...talk,
      id: "not-a-uuid",
    } as never);

    const res = await send({ title: "A real title" });

    expect(res.status).toBe(500);
    expect((await body(res)).error?.code).toBe("INTERNAL_ERROR");
  });
});
