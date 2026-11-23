import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError } from "@/src/core/http";
import {
  cancelledKeynote,
  EVENT_ID,
  HALL_A_ID,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
  talk,
} from "@/src/features/sessions/__fixtures__/organizer-sessions";
import { sessionService } from "@/src/features/sessions/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
import { GET, POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (ownership, hall and speaker clashes, Strapi) have their own tests.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { listSessions: jest.fn(), createSession: jest.fn() },
}));
const service = jest.mocked(sessionService);

const PATH = `/api/events/${EVENT_ID}/sessions`;
const params = { eventId: EVENT_ID };

/** A valid in-person talk as the add-session form sends it. */
const newTalk = {
  title: "  Offline-first Event Apps  ",
  type: "talk",
  mode: "in_person",
  hallId: HALL_A_ID,
  startAt: "2026-12-12T10:00:00+05:30",
  endAt: "2026-12-12T11:00:00+05:30",
  speakers: [{ speakerId: SPEAKER_ANANYA_ID }],
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/sessions", () => {
  beforeEach(() =>
    service.listSessions.mockResolvedValue([cancelledKeynote, talk]),
  );

  it("answers every session of the event", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [cancelledKeynote, talk] });
  });

  it("hands the service the event and the caller", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.listSessions).toHaveBeenCalledWith(
      EVENT_ID,
      users.organizer,
    );
  });

  it("lets an admin read the sessions (SESSION_MANAGE)", async () => {
    signInAs(users.admin);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(service.listSessions).toHaveBeenCalledWith(EVENT_ID, users.admin);
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.listSessions).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("FORBIDDEN");
    expect(service.listSessions).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/nope/sessions", {
      params: { eventId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listSessions).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (another organizer's event)", async () => {
    service.listSessions.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });
});

describe("POST /api/events/[eventId]/sessions", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, body: sent, headers });

  beforeEach(() => service.createSession.mockResolvedValue(talk));

  it("creates the session: 201 with the new session", async () => {
    const res = await send(newTalk);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: talk });
  });

  it("hands the service the parsed body: trimmed title, dates as Date, defaults filled in", async () => {
    await send(newTalk);

    expect(service.createSession).toHaveBeenCalledWith(
      EVENT_ID,
      {
        title: "Offline-first Event Apps",
        type: "talk",
        mode: "in_person",
        hallId: HALL_A_ID,
        startAt: new Date("2026-12-12T04:30:00.000Z"),
        endAt: new Date("2026-12-12T05:30:00.000Z"),
        requiresRegistration: false,
        price: 0,
        speakers: [{ speakerId: SPEAKER_ANANYA_ID, role: "speaker" }],
      },
      users.organizer,
    );
  });

  it.each([
    ["no title", { ...newTalk, title: undefined }],
    ["an unknown type", { ...newTalk, type: "concert" }],
    [
      "a start with no time zone",
      { ...newTalk, startAt: "2026-12-12T10:00:00" },
    ],
    [
      "an end before the start",
      { ...newTalk, endAt: "2026-12-12T09:00:00+05:30" },
    ],
    ["an in-person session with no hall", { ...newTalk, hallId: undefined }],
    ["no speakers", { ...newTalk, speakers: [] }],
    [
      "the same speaker twice",
      {
        ...newTalk,
        speakers: [
          { speakerId: SPEAKER_ANANYA_ID },
          { speakerId: SPEAKER_ANANYA_ID },
        ],
      },
    ],
    [
      "only moderators",
      {
        ...newTalk,
        speakers: [{ speakerId: SPEAKER_ROHAN_ID, role: "moderator" }],
      },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(POST, "POST", "/api/events/nope/sessions", {
      params: { eventId: "nope" },
      body: newTalk,
    });

    expect(res.status).toBe(400);
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(newTalk);

    expect(res.status).toBe(401);
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("refuses a caller without SESSION_CREATE (403), even one who may manage sessions", async () => {
    signInAs(userWith(["SESSION_MANAGE"]));

    const res = await send(newTalk);

    expect(res.status).toBe(403);
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403)", async () => {
    signInAs(users.user);

    const res = await send(newTalk);

    expect(res.status).toBe(403);
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(newTalk, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it("passes on a 409 with its code (the hall is taken)", async () => {
    service.createSession.mockRejectedValue(
      new ConflictError("HALL_BUSY", "Hall A is booked at that time"),
    );

    const res = await send(newTalk);

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: { code: "HALL_BUSY", message: "Hall A is booked at that time" },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send(newTalk);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.createSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
