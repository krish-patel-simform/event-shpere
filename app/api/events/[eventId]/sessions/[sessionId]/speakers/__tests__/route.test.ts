import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/src/core/http";
import {
  EVENT_ID,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
  workshop,
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
import { PUT } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (ownership, real speaker profiles, cancelled or ended) have their own tests.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { replaceSpeakers: jest.fn() },
}));
const service = jest.mocked(sessionService);

const SESSION_ID = workshop.id;
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/speakers`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const twoSpeakers = {
  speakers: [
    { speakerId: SPEAKER_ANANYA_ID },
    { speakerId: SPEAKER_ROHAN_ID, role: "moderator" },
  ],
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(PUT, "PUT", PATH, { params, body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.replaceSpeakers.mockResolvedValue(workshop);
});
afterEach(() => jest.restoreAllMocks());

describe("PUT /api/events/[eventId]/sessions/[sessionId]/speakers", () => {
  it("replaces the speakers: 200 with the session", async () => {
    const res = await send(twoSpeakers);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: workshop });
  });

  it("hands the service the list in order, a missing role defaulting to speaker", async () => {
    await send(twoSpeakers);

    expect(service.replaceSpeakers).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      {
        speakers: [
          { speakerId: SPEAKER_ANANYA_ID, role: "speaker" },
          { speakerId: SPEAKER_ROHAN_ID, role: "moderator" },
        ],
      },
      users.organizer,
    );
  });

  it.each([
    ["no list", {}],
    ["an empty list", { speakers: [] }],
    [
      "a speaker id that is not a uuid",
      { speakers: [{ speakerId: "ananya" }] },
    ],
    [
      "an unknown role",
      { speakers: [{ speakerId: SPEAKER_ANANYA_ID, role: "dj" }] },
    ],
    [
      "the same speaker twice",
      {
        speakers: [
          { speakerId: SPEAKER_ANANYA_ID },
          { speakerId: SPEAKER_ANANYA_ID, role: "host" },
        ],
      },
    ],
    [
      "only moderators",
      { speakers: [{ speakerId: SPEAKER_ROHAN_ID, role: "moderator" }] },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("refuses a session id that is not a uuid (400)", async () => {
    const res = await call(PUT, "PUT", PATH, {
      params: { eventId: EVENT_ID, sessionId: "nope" },
      body: twoSpeakers,
    });

    expect(res.status).toBe(400);
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(twoSpeakers);

    expect(res.status).toBe(401);
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send(twoSpeakers);

    expect(res.status).toBe(403);
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 EVENT_READ_ONLY for an admin", async () => {
    signInAs(users.admin);
    service.replaceSpeakers.mockRejectedValue(
      new ForbiddenError(
        "Admins can view this event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send(twoSpeakers);

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(twoSpeakers, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("passes on the service's 400 for an id that is not a speaker profile", async () => {
    service.replaceSpeakers.mockRejectedValue(
      new ValidationError("A speaker was not found"),
    );

    const res = await send(twoSpeakers);

    expect(res.status).toBe(400);
  });

  it("passes on the service's 404 (a session of another event)", async () => {
    service.replaceSpeakers.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await send(twoSpeakers);

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code (the session is cancelled)", async () => {
    service.replaceSpeakers.mockRejectedValue(
      new ConflictError("SESSION_CANCELLED", "This session is cancelled"),
    );

    const res = await send(twoSpeakers);

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("SESSION_CANCELLED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send(twoSpeakers);

    expect(res.status).toBe(429);
    expect(service.replaceSpeakers).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
