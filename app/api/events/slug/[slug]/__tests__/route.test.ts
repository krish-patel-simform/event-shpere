import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import type { PublicEventDetailDto } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";
import { FINTECH_ID } from "@/src/features/events/__fixtures__/event-manage";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
} from "../../../../__fixtures__/route-test";
import { GET } from "../route";

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
// Which events are public (published or cancelled, never a draft) is the service's rule.
jest.mock("@/src/features/events/server", () => ({
  eventService: { getPublicEvent: jest.fn() },
}));
const service = jest.mocked(eventService);

const SLUG = "fintech-product-forum";
const PATH = `/api/events/slug/${SLUG}`;
const params = { slug: SLUG };

const detail: PublicEventDetailDto = {
  id: FINTECH_ID,
  slug: SLUG,
  title: "Fintech Product Forum",
  status: "published",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venue: {
    name: "Hotel Orchid",
    addressLine: "Plot 12, Baner Road, Pune 411045",
    city: "Pune",
    state: "Maharashtra",
    postalCode: "411045",
  },
  ticketPrice: 0,
  seatsLeft: 250,
  registrationOpensAt: "2026-11-01T04:30:00.000Z",
  registrationClosesAt: "2026-12-11T18:30:00.000Z",
  content: null,
  sessions: [
    {
      id: "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a",
      title: "Opening keynote",
      type: "keynote",
      mode: "in_person",
      startAt: "2026-12-12T04:30:00.000Z",
      endAt: "2026-12-12T05:30:00.000Z",
      hallName: "Hall 1",
      price: 0,
      requiresRegistration: false,
      speakers: [{ slug: "priya-shah", name: "Priya Shah", role: "speaker" }],
    },
  ],
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.getPublicEvent.mockResolvedValue(detail);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events/slug/[slug]", () => {
  it("answers a guest the event's public page, which a CDN may keep briefly", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: detail });
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
  });

  it("hands the service the slug from the URL", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getPublicEvent).toHaveBeenCalledWith(SLUG);
  });

  it.each([
    ["upper-case letters", "Fintech-Forum"],
    ["a space", "fintech forum"],
    ["a leading dash", "-fintech"],
    ["a double dash", "fintech--forum"],
    ["over 255 characters", "a".repeat(256)],
  ])(
    "refuses a slug with %s (400) without asking the service",
    async (_name, slug) => {
      const res = await call(GET, "GET", `/api/events/slug/x`, {
        params: { slug },
      });

      expect(res.status).toBe(400);
      expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
      expect(service.getPublicEvent).not.toHaveBeenCalled();
    },
  );

  it("passes on the service's 404 (a draft or an unknown link), and no cache may keep it", async () => {
    service.getPublicEvent.mockRejectedValue(
      new NotFoundError("Event not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("counts the caller's IP against the public read limit, and answers 429 when it is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH, {
      params,
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(res.status).toBe(429);
    expect(service.getPublicEvent).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("never answers a draft even if the service returned one (500, the contract only allows published or cancelled)", async () => {
    service.getPublicEvent.mockResolvedValue({
      ...detail,
      status: "draft",
    } as never);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
  });
});
