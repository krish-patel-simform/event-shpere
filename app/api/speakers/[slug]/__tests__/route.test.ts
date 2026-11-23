import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import { speakerService } from "@/src/features/speakers/server";
import { ananyaProfile } from "@/src/features/speakers/__fixtures__/speakers";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  users,
} from "../../../__fixtures__/route-test";
import { GET } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (CMS fallback, suspended speakers) have their own tests: here it is faked.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { getSpeakerBySlug: jest.fn() },
}));
const service = jest.mocked(speakerService);

const SLUG = ananyaProfile.slug;
const PATH = `/api/speakers/${SLUG}`;
const params = { slug: SLUG };

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.getSpeakerBySlug.mockResolvedValue(ananyaProfile);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/speakers/[slug]", () => {
  it("answers a guest the public profile, which no cache may keep", async () => {
    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: ananyaProfile });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service for the slug without the manage view for a guest", async () => {
    await call(GET, "GET", PATH, { params });

    expect(service.getSpeakerBySlug).toHaveBeenCalledWith(SLUG, {
      canManage: false,
    });
  });

  it("gives someone who manages every speaker the account's state", async () => {
    signInAs(users.admin);
    const withStatus = { ...ananyaProfile, accountStatus: "pending" as const };
    service.getSpeakerBySlug.mockResolvedValue(withStatus);

    const res = await call(GET, "GET", PATH, { params });

    expect(service.getSpeakerBySlug).toHaveBeenCalledWith(SLUG, {
      canManage: true,
    });
    expect(await body(res)).toEqual({ data: withStatus });
  });

  it("does not give an organizer the manage view", async () => {
    signInAs(users.organizer);

    await call(GET, "GET", PATH, { params });

    expect(service.getSpeakerBySlug).toHaveBeenCalledWith(SLUG, {
      canManage: false,
    });
  });

  it.each([
    ["upper-case letters", "Ananya-Rao"],
    ["an underscore", "ananya_rao"],
    ["a trailing dash", "ananya-"],
    ["over 100 characters", "a".repeat(101)],
  ])(
    "refuses a slug with %s (400) without asking the service",
    async (_name, slug) => {
      const res = await call(GET, "GET", `/api/speakers/${slug}`, {
        params: { slug },
      });

      expect(res.status).toBe(400);
      expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
      expect(service.getSpeakerBySlug).not.toHaveBeenCalled();
    },
  );

  it("passes on the service's 404 for an unknown or suspended speaker", async () => {
    service.getSpeakerBySlug.mockRejectedValue(
      new NotFoundError("Speaker not found"),
    );

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({
      error: { code: "NOT_FOUND", message: "Speaker not found" },
    });
  });

  it("counts a guest against the public read limit by IP", async () => {
    await call(GET, "GET", PATH, {
      params,
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
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
    expect(service.getSpeakerBySlug).not.toHaveBeenCalled();
  });

  it("never answers a profile link that is not http(s) (500)", async () => {
    service.getSpeakerBySlug.mockResolvedValue({
      ...ananyaProfile,
      profile: {
        ...ananyaProfile.profile,
        links: {
          linkedin: "javascript:alert(1)",
          twitter: null,
          website: null,
        },
      },
    } as never);

    const res = await call(GET, "GET", PATH, { params });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("javascript:");
  });
});
