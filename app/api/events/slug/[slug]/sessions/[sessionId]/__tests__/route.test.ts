import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import { FINTECH_ID } from "@/src/features/events/__fixtures__/event-manage";
import type { PublicSessionDetailDto } from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
} from "../../../../../../__fixtures__/route-test";
import { GET } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// Which sessions are public (scheduled, of a published or cancelled event) is the service's rule.
jest.mock("@/src/features/sessions/server", () => ({
  sessionService: { getPublicSession: jest.fn() },
}));
const service = jest.mocked(sessionService);

const SLUG = "fintech-product-forum";
const SESSION_ID = "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a";
const PATH = `/api/events/slug/${SLUG}/sessions/${SESSION_ID}`;
const params = { slug: SLUG, sessionId: SESSION_ID };

const session: PublicSessionDetailDto = {
  id: SESSION_ID,
  title: "Hands-on: payments APIs",
  type: "workshop",
  mode: "in_person",
  startAt: "2026-12-12T05:00:00.000Z",
  endAt: "2026-12-12T07:00:00.000Z",
  hallName: "Hall 2",
  price: 0,
  requiresRegistration: true,
  speakers: [
    {
      id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
      slug: "priya-shah",
      name: "Priya Shah",
      role: "speaker",
    },
  ],
  hallCapacity: 30,
  seatsLeft: 12,
  venue: {
    name: "Hotel Orchid",
    addressLine: "Plot 12, Baner Road, Pune 411045",
    city: "Pune",
  },
  event: {
    id: FINTECH_ID,
    slug: SLUG,
    title: "Fintech Product Forum",
    status: "published",
    timezone: "Asia/Kolkata",
    startAt: "2026-12-12T04:00:00.000Z",
    registrationClosesAt: null,
  },
  content: null,
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.getPublicSession.mockResolvedValue(session);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/slug/[slug]/sessions/[sessionId]", () => {
  it("answers a guest the session's public page, which a CDN may keep briefly", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: session });
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
  });

  it("hands the service the event's slug and the session id", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getPublicSession).toHaveBeenCalledWith(SLUG, SESSION_ID);
  });

  it.each([
    [
      "a slug that is not a slug",
      { slug: "Fintech Forum", sessionId: SESSION_ID },
    ],
    ["a session id that is not a uuid", { slug: SLUG, sessionId: "42" }],
  ])("refuses %s (400) without asking the service", async (_name, bad) => {
    const res = await call(GET, "GET", PATH, { params: bad });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.getPublicSession).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 (a draft event, or a session of another event)", async () => {
    service.getPublicSession.mockRejectedValue(
      new NotFoundError("Session not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("counts the caller's IP against the public read limit, and answers 429 when it is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(429);
    expect(service.getPublicSession).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("public-read-ip", "local");
  });

  it("never leaks a field the public contract does not have (the join link is dropped)", async () => {
    service.getPublicSession.mockResolvedValue({
      ...session,
      joinUrl: "https://meet.example/secret",
    } as never);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(JSON.stringify(await body(res))).not.toContain("meet.example");
  });
});
