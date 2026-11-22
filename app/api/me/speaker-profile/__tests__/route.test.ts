import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError, ServiceUnavailableError } from "@/src/core/http";
import type { OwnSpeakerProfileDto } from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../__fixtures__/route-test";
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
// Postgres + Strapi saving and the "is this a speaker" lookup are the service's job.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { getOwnProfile: jest.fn(), updateOwnProfile: jest.fn() },
}));
const service = jest.mocked(speakerService);

const PATH = "/api/me/speaker-profile";

const profile: OwnSpeakerProfileDto = {
  slug: "ananya-rao",
  firstName: "Ananya",
  lastName: "Rao",
  jobTitle: "Staff Engineer",
  company: "Orbit Labs",
  bio: "Builds design systems.\n\nSpeaks about accessibility.",
  expertise: ["Design systems", "Accessibility"],
  linkedinUrl: "https://www.linkedin.com/in/ananya-rao",
  twitterUrl: null,
  websiteUrl: null,
  photo: {
    url: "https://cms.example.test/uploads/ananya.png",
    alt: "Ananya Rao",
    width: 400,
    height: 400,
  },
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.speaker);
  service.getOwnProfile.mockResolvedValue(profile);
  service.updateOwnProfile.mockResolvedValue(profile);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/me/speaker-profile", () => {
  it("answers the edit form's current values", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: profile });
  });

  it("looks the profile up by the signed-in speaker's id, never one from the request", async () => {
    await call(GET, "GET", PATH, { query: { userId: users.admin.id } });

    expect(service.getOwnProfile).toHaveBeenCalledWith(users.speaker.id);
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.getOwnProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["an attendee", users.user],
    ["an organizer", users.organizer],
    ["an admin", users.admin],
  ])("refuses %s (403): only a speaker has this form", async (_name, who) => {
    signInAs(who);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(403);
    expect(service.getOwnProfile).not.toHaveBeenCalled();
  });

  it("needs only SPEAKER_MANAGE_OWN", async () => {
    signInAs(userWith(["SPEAKER_MANAGE_OWN"]));

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
  });

  it("passes on the service's 404 when the caller has no speaker profile", async () => {
    service.getOwnProfile.mockRejectedValue(
      new NotFoundError("Speaker profile not found"),
    );

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(404);
  });

  it("counts the caller against the read limit", async () => {
    await call(GET, "GET", PATH);

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.speaker.id);
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(service.getOwnProfile).not.toHaveBeenCalled();
  });

  it("never answers a profile that breaks the contract (500), e.g. an unsafe photo URL", async () => {
    service.getOwnProfile.mockResolvedValue({
      ...profile,
      photo: { ...profile.photo!, url: "javascript:alert(1)" },
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/me/speaker-profile", () => {
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(PATCH, "PATCH", PATH, { body: sent, headers });

  it("saves the sent fields: 200 with the form's new values", async () => {
    const res = await send({ jobTitle: "Principal Engineer" });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: profile });
  });

  it("hands the service only what was sent, trimmed, blanks turned into null and topics de-duplicated", async () => {
    await send({
      firstName: "  Ananya ",
      company: "   ",
      twitterUrl: "",
      expertise: [" Design systems", "design SYSTEMS", "A11y "],
    });

    expect(service.updateOwnProfile).toHaveBeenCalledWith(users.speaker.id, {
      firstName: "Ananya",
      company: null,
      twitterUrl: null,
      expertise: ["Design systems", "A11y"],
    });
  });

  it("drops fields a speaker may not change here (slug, email, photo)", async () => {
    await send({
      bio: "New bio",
      slug: "someone-else",
      email: "x@example.test",
      photo: { url: "https://evil.example/x.png" },
    });

    expect(service.updateOwnProfile).toHaveBeenCalledWith(users.speaker.id, {
      bio: "New bio",
    });
  });

  it.each([
    ["an empty body", {}],
    ["a body with only unknown fields", { slug: "x" }],
    ["a blank first name", { firstName: "  " }],
    ["a link that is not http(s)", { websiteUrl: "javascript:alert(1)" }],
    [
      "more than 10 topics",
      { expertise: Array.from({ length: 11 }, (_, i) => `t${i}`) },
    ],
    ["a bio over 5000 characters", { bio: "x".repeat(5001) }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send({ bio: "New bio" });

    expect(res.status).toBe(401);
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });

  it("refuses an organizer (403): they edit speakers from the event, not here", async () => {
    signInAs(users.organizer);

    const res = await send({ bio: "New bio" });

    expect(res.status).toBe(403);
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before anything is saved", async () => {
    const res = await send(
      { bio: "New bio" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });

  it("passes on the service's 503 when the CMS is down", async () => {
    service.updateOwnProfile.mockRejectedValue(
      new ServiceUnavailableError("CMS_UNAVAILABLE", "Try again shortly"),
    );

    const res = await send({ bio: "New bio" });

    expect(res.status).toBe(503);
    expect((await body(res)).error?.code).toBe("CMS_UNAVAILABLE");
  });

  it("counts the caller against the write limit", async () => {
    await send({ bio: "New bio" });

    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.speaker.id,
    );
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send({ bio: "New bio" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });
});
