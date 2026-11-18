import { NextRequest } from "next/server";
import { NotFoundError } from "@/src/core/http";
import { publicEventDetailSchema } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import { publicSessionDetailSchema } from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";
import { speakerSessionService } from "@/src/features/speakers/server";
import { GET as getEvents } from "../events/route";
import { GET as getEvent } from "../events/slug/[slug]/route";
import { GET as getSession } from "../events/slug/[slug]/sessions/[sessionId]/route";
import { GET as getSpeakerSessions } from "../speakers/[slug]/sessions/route";

// Four public GET routes answer the same to everyone, so the CDN may keep their answer for a short
// time. Services are faked: only what the routes put on the response is checked. The two detail
// schemas' `parse` is stubbed to pass any value, because the point here is the headers, not the
// shape of an event.
jest.mock("@/src/features/events/server", () => ({
  eventService: { listPublicEvents: jest.fn(), getPublicEvent: jest.fn() },
}));
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { getPublicSession: jest.fn() },
}));
jest.mock("@/src/features/speakers/server", () => ({
  speakerSessionService: { listSpeakerSessions: jest.fn() },
}));
// The rate limiter stays out too: it would count every test against the real Redis.
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));

const mockListEvents = jest.mocked(eventService.listPublicEvents);
const mockGetEvent = jest.mocked(eventService.getPublicEvent);
const mockGetSession = jest.mocked(sessionService.getPublicSession);
const mockListSpeakerSessions = jest.mocked(
  speakerSessionService.listSpeakerSessions,
);

const PUBLIC_CACHE =
  "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const SESSION_ID = "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4";

const request = (path: string) =>
  new NextRequest(`http://localhost/api/${path}`);
const params = <P>(value: P) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  // The detail schemas let any value through: the point here is the headers, not the event's shape.
  jest
    .spyOn(publicEventDetailSchema, "parse")
    .mockImplementation((value) => value as never);
  jest
    .spyOn(publicSessionDetailSchema, "parse")
    .mockImplementation((value) => value as never);
  mockListEvents.mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 12, total: 0 },
  });
  mockGetEvent.mockResolvedValue({ title: "Gala" } as never);
  mockGetSession.mockResolvedValue({ title: "Keynote" } as never);
  mockListSpeakerSessions.mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 10, total: 0, totalSessions: 0 },
  });
});

describe("public GET routes that are the same for everyone", () => {
  it.each([
    ["the event list", () => getEvents(request("events"), params({}))],
    [
      "one event",
      () => getEvent(request("events/slug/gala"), params({ slug: "gala" })),
    ],
    [
      "one session",
      () =>
        getSession(
          request(`events/slug/gala/sessions/${SESSION_ID}`),
          params({ slug: "gala", sessionId: SESSION_ID }),
        ),
    ],
    [
      "a speaker's sessions",
      () =>
        getSpeakerSessions(
          request("speakers/ananya/sessions"),
          params({ slug: "ananya" }),
        ),
    ],
  ])("%s may be kept by the CDN for a short time", async (_name, call) => {
    const res = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(PUBLIC_CACHE);
    // Nothing in the answer depends on the cookie, so no Vary or Set-Cookie ties it to a viewer.
    expect(res.headers.get("Vary")).toBeNull();
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("never lets the CDN keep a 404 (a draft event looks the same as an unknown one)", async () => {
    mockGetEvent.mockRejectedValue(new NotFoundError("Event not found"));

    const res = await getEvent(
      request("events/slug/draft-event"),
      params({ slug: "draft-event" }),
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("never lets the CDN keep a validation error", async () => {
    const res = await getEvent(
      request("events/slug/Not%20A%20Slug"),
      params({ slug: "Not A Slug" }),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});
