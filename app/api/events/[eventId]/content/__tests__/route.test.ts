import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "@/src/core/http";
import type { EventContentDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import { FINTECH_ID } from "@/src/features/events/__fixtures__/event-manage";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../../__fixtures__/route-test";
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
// Who may read or edit the page (own events, admin read-only) is the service's rule.
jest.mock("@/src/features/events/server", () => ({
  eventService: { getContent: jest.fn(), updateContent: jest.fn() },
}));
const service = jest.mocked(eventService);

const EVENT_ID = FINTECH_ID;
const PATH = `/api/events/${EVENT_ID}/content`;
const params = { eventId: EVENT_ID };

const content: EventContentDto = {
  tagline: "Where payments meet product",
  about: "A day on payments.\n\nTalks and workshops.",
  venueGuide: "",
  highlights: [{ title: "UPI deep dive", description: "" }],
  faqs: [{ question: "Is lunch included?", answer: "Yes." }],
  seo: { metaTitle: null, metaDescription: null },
  coverImage: {
    id: 12,
    url: "https://cms.example/uploads/cover.jpg",
    alt: null,
    width: 1600,
    height: 900,
  },
  gallery: [],
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/[eventId]/content", () => {
  beforeEach(() => service.getContent.mockResolvedValue(content));

  it("answers the edit form's current values", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: content });
  });

  it("hands the service the event and the caller (an admin may read it too)", async () => {
    signInAs(users.admin);

    await call(GET, "GET", PATH, { params });

    expect(service.getContent).toHaveBeenCalledWith(EVENT_ID, users.admin);
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(401);
    expect(service.getContent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await call(GET, "GET", "/api/events/nope/content", {
      params: { eventId: "nope" },
    });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getContent).not.toHaveBeenCalled();
  });

  it("passes on the service's 503 when the CMS cannot be read", async () => {
    service.getContent.mockRejectedValue(
      new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "The event page cannot be loaded right now",
      ),
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

describe("PATCH /api/events/[eventId]/content", () => {
  const send = (
    sent: unknown,
    options: { headers?: Record<string, string>; eventId?: string } = {},
  ) =>
    call(PATCH, "PATCH", PATH, {
      params: { eventId: options.eventId ?? EVENT_ID },
      body: sent,
      headers: options.headers,
    });

  beforeEach(() => service.updateContent.mockResolvedValue(content));

  it("saves the fields sent: 200 with the whole content", async () => {
    const res = await send({ tagline: "Where payments meet product" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: content });
  });

  it("hands the service the parsed fields (trimmed, default highlight description, nulls kept) and the caller", async () => {
    await send({
      tagline: "  Where payments meet product ",
      about: null,
      highlights: [{ title: " UPI deep dive " }],
      seo: null,
      coverImage: "ignored: images have their own routes",
    });

    expect(service.updateContent).toHaveBeenCalledWith(
      EVENT_ID,
      {
        tagline: "Where payments meet product",
        about: null,
        highlights: [{ title: "UPI deep dive", description: "" }],
        seo: null,
      },
      users.organizer,
    );
  });

  it.each([
    ["an empty body", {}],
    ["a body with only unknown fields", { coverImage: null }],
    ["a tagline over 160 characters", { tagline: "x".repeat(161) }],
    ["a highlight without a title", { highlights: [{ title: " " }] }],
    [
      "more than 8 highlights",
      { highlights: Array.from({ length: 9 }, () => ({ title: "A" })) },
    ],
    ["an FAQ without an answer", { faqs: [{ question: "Why?", answer: "" }] }],
    ["an SEO title over 70 characters", { seo: { metaTitle: "x".repeat(71) } }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("refuses an event id that is not a uuid (400)", async () => {
    const res = await send({ tagline: "Hi" }, { eventId: "nope" });

    expect(res.status).toBe(400);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ tagline: "Hi" });

    expect(res.status).toBe(401);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("answers an admin's edit with the service's 403 EVENT_READ_ONLY", async () => {
    signInAs(users.admin);
    service.updateContent.mockRejectedValue(
      new ForbiddenError(
        "An admin can view an organizer's event but not change it",
        "EVENT_READ_ONLY",
      ),
    );

    const res = await send({ tagline: "Hi" });

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EVENT_READ_ONLY");
  });

  it("passes on the service's 404 (someone else's event)", async () => {
    service.updateContent.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await send({ tagline: "Hi" });

    expect(res.status).toBe(404);
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(
      { tagline: "Hi" },
      { headers: { origin: "https://evil.example" } },
    );

    expect(res.status).toBe(403);
    expect(service.updateContent).not.toHaveBeenCalled();
  });

  it("answers 429 when the write limit is reached, counted by the caller's id", async () => {
    rateLimited();

    const res = await send({ tagline: "Hi" });

    expect(res.status).toBe(429);
    expect(service.updateContent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
