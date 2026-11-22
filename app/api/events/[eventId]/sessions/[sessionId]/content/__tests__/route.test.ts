import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "@/src/core/http";
import type { SessionContentDto } from "@/src/features/sessions";
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
// The service's rules (ownership, Strapi reads and writes) have their own tests.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { getContent: jest.fn(), updateContent: jest.fn() },
}));
const service = jest.mocked(sessionService);

const SESSION_ID = talk.id;
const PATH = `/api/events/${EVENT_ID}/sessions/${SESSION_ID}/content`;
const params = { eventId: EVENT_ID, sessionId: SESSION_ID };

const content: SessionContentDto = {
  description: "Build event apps that keep working offline.",
  prerequisites: "Basic React",
  resources: [{ label: "Slides", url: "https://example.com/slides" }],
  coverImage: {
    id: 12,
    url: "https://cdn.example.com/cover.jpg",
    alt: null,
    width: 1200,
    height: 630,
  },
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/sessions/[sessionId]/content", () => {
  beforeEach(() => service.getContent.mockResolvedValue(content));

  it("answers the content form's current values", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: content });
    expect(service.getContent).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      users.organizer,
    );
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getContent).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(403);
    expect(service.getContent).not.toHaveBeenCalled();
  });

  it("refuses a session id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", PATH, {
      params: { eventId: EVENT_ID, sessionId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getContent).not.toHaveBeenCalled();
  });

  it("passes on the service's 503 when Strapi is down", async () => {
    service.getContent.mockRejectedValue(
      new ServiceUnavailableError("CMS_UNAVAILABLE", "Content is unavailable"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(503);
    expect((await body(res)).error?.code).toBe("CMS_UNAVAILABLE");
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH, { params });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-read",
      users.organizer.id,
    );
  });
});

describe("PATCH /api/events/[eventId]/sessions/[sessionId]/content", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(PATCH, "PATCH", PATH, { params, body: sent, headers });

  beforeEach(() => service.updateContent.mockResolvedValue(content));

  it("saves the fields sent: 200 with the content", async () => {
    const res = await send({ description: "New text" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: content });
  });

  it("hands the service only the fields sent, trimmed (null clears a text)", async () => {
    await send({
      description: "  New text  ",
      prerequisites: null,
      resources: [{ label: " Slides ", url: "https://example.com/slides" }],
    });

    expect(service.updateContent).toHaveBeenCalledWith(
      EVENT_ID,
      SESSION_ID,
      {
        description: "New text",
        prerequisites: null,
        resources: [{ label: "Slides", url: "https://example.com/slides" }],
      },
      users.organizer,
    );
  });

  it.each([
    ["an empty body", {}],
    ["only unknown fields", { coverImage: 12 }],
    ["a description that is too long", { description: "x".repeat(10_001) }],
    [
      "a resource link that is not https",
      { resources: [{ label: "Slides", url: "http://example.com" }] },
    ],
    [
      "more than 10 resources",
      {
        resources: Array.from({ length: 11 }, (_, i) => ({
          label: `R${i}`,
          url: "https://example.com",
        })),
      },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(PATCH, "PATCH", PATH, {
      params: { eventId: "nope", sessionId: SESSION_ID },
      body: { description: "New text" },
    });

    expect(res.status).toBe(400);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ description: "New text" });

    expect(res.status).toBe(401);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("refuses a plain user (403): SESSION_MANAGE is required", async () => {
    signInAs(users.user);

    const res = await send({ description: "New text" });

    expect(res.status).toBe(403);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 EVENT_READ_ONLY for an admin", async () => {
    signInAs(users.admin);
    service.updateContent.mockRejectedValue(
      new ForbiddenError(
        "Admins can view this event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send({ description: "New text" });

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { description: "New text" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a session of another event)", async () => {
    service.updateContent.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await send({ description: "New text" });

    expect(res.status).toBe(404);
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ description: "New text" });

    expect(res.status).toBe(429);
    expect(service.updateContent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
