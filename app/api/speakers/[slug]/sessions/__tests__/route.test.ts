import { readAccessTokenCookie } from "@/src/core/auth/server/auth-cookies";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import type { SpeakerSessionGroupDto } from "@/src/features/speakers";
import { speakerSessionService } from "@/src/features/speakers/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
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
// The service's rules (which sessions, which timeline) have their own tests: here it is faked.
jest.mock("@/src/features/speakers/server", () => ({
  speakerSessionService: { listSpeakerSessions: jest.fn() },
}));
const service = jest.mocked(speakerSessionService);

const SLUG = "ananya-rao-3f9a1c";
const PATH = `/api/speakers/${SLUG}/sessions`;
const params = { slug: SLUG };

const group: SpeakerSessionGroupDto = {
  event: {
    slug: "react-summit-2026",
    title: "React Summit 2026",
    startAt: "2026-12-12T03:30:00.000Z",
    endAt: "2026-12-13T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    venue: { name: "GIFT City Convention Centre", city: "Gandhinagar" },
    ticketPrice: 0,
  },
  sessions: [
    {
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e01",
      title: "Server Components in practice",
      type: "talk",
      mode: "in_person",
      startAt: "2026-12-12T04:30:00.000Z",
      endAt: "2026-12-12T05:15:00.000Z",
      hallName: "Main Auditorium",
      price: 0,
      requiresRegistration: true,
      seatsLeft: 42,
    },
  ],
};
const meta = { page: 1, pageSize: 5, total: 1, totalSessions: 1 };

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.listSpeakerSessions.mockResolvedValue({ items: [group], meta });
});
afterEach(() => jest.restoreAllMocks());

// The cache headers are checked in app/api/__tests__/public-cache-headers.test.ts.
describe("GET /api/speakers/[slug]/sessions", () => {
  it("answers a guest the sessions grouped by event, with the paging meta", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [group], meta });
  });

  it("asks for upcoming sessions, page 1 of 5 events, by default", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.listSpeakerSessions).toHaveBeenCalledWith(SLUG, {
      timeline: "upcoming",
      page: 1,
      pageSize: 5,
    });
  });

  it("hands the service the parsed timeline and paging", async () => {
    await call(GET, "GET", PATH, {
      params,
      query: { timeline: "past", page: "3", pageSize: "20" },
    });

    expect(service.listSpeakerSessions).toHaveBeenCalledWith(SLUG, {
      timeline: "past",
      page: 3,
      pageSize: 20,
    });
  });

  it("answers the same to a signed-in caller without reading who they are", async () => {
    signInAs(users.admin);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(readAccessTokenCookie).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown timeline", { timeline: "soon" }],
    ["a page below 1", { page: "0" }],
    ["more than 20 events a page", { pageSize: "21" }],
    ["a page that is not a number", { page: "two" }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { params, query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listSpeakerSessions).not.toHaveBeenCalled();
  });

  it("refuses a slug that is not one (400) without asking the service", async () => {
    const res = await call(GET, "GET", "/api/speakers/Not_A_Slug/sessions", {
      params: { slug: "Not_A_Slug" },
    });

    expect(res.status).toBe(400);
    expect(service.listSpeakerSessions).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown or suspended speaker", async () => {
    service.listSpeakerSessions.mockRejectedValue(
      new NotFoundError("Speaker not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts a guest against the public read limit by IP", async () => {
    await call(GET, "GET", PATH, {
      params,
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.listSpeakerSessions).not.toHaveBeenCalled();
  });

  it("never answers a meta that breaks the contract (500)", async () => {
    service.listSpeakerSessions.mockResolvedValue({
      items: [group],
      meta: { page: 1, pageSize: 5, total: 1 } as never,
    });

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
  });

  it("never answers an event group without sessions (500)", async () => {
    service.listSpeakerSessions.mockResolvedValue({
      items: [{ ...group, sessions: [] }],
      meta,
    });

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
  });
});
