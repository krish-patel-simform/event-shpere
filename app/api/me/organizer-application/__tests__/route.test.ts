import { assertRateLimit } from "@/src/core/http/rate-limit";
import { NotFoundError } from "@/src/core/http";
import type { OwnOrganizerApplicationDto } from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../__fixtures__/route-test";
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
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: { getOwnApplication: jest.fn() },
}));
const service = jest.mocked(organizerService);

const PATH = "/api/me/organizer-application";
const rejected: OwnOrganizerApplicationDto = {
  status: "rejected",
  organizationName: "Kinetic Events",
  organizationWebsite: "https://kinetic.test",
  appliedAt: "2026-11-01T09:00:00.000Z",
  emailVerifiedAt: "2026-11-01T09:05:00.000Z",
  verifiedAt: null,
  rejectedAt: "2026-11-03T12:00:00.000Z",
  rejectionReason: "The website does not load",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.getOwnApplication.mockResolvedValue(rejected);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/me/organizer-application", () => {
  it("answers the caller's own application, with the rejection reason", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: rejected });
  });

  it("looks the application up by the signed-in organizer's id, never one from the request", async () => {
    await call(GET, "GET", PATH, {
      query: { userId: users.admin.id },
    });

    expect(service.getOwnApplication).toHaveBeenCalledWith(users.organizer.id);
  });

  it("refuses a guest (401) without asking the service", async () => {
    signInAs(null);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(401);
    expect(service.getOwnApplication).not.toHaveBeenCalled();
  });

  it.each([
    ["an attendee", users.user],
    ["an admin", users.admin],
  ])(
    "refuses %s (403): only an organizer has an application",
    async (_name, who) => {
      signInAs(who);

      const res = await call(GET, "GET", PATH);

      expect(res.status).toBe(403);
      expect(service.getOwnApplication).not.toHaveBeenCalled();
    },
  );

  it("needs exactly ORGANIZER_PROFILE_MANAGE_OWN", async () => {
    signInAs(userWith(["ORGANIZER_PROFILE_MANAGE_OWN"]));

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
  });

  it("passes on the service's 404 when the organizer has no application", async () => {
    service.getOwnApplication.mockRejectedValue(
      new NotFoundError("Organizer profile not found"),
    );

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(404);
    expect((await body(res)).error?.code).toBe("NOT_FOUND");
  });

  it("counts the caller against the read limit, before the permission check", async () => {
    signInAs(users.user);

    await call(GET, "GET", PATH);

    expect(assertRateLimit).toHaveBeenCalledWith("user-read", users.user.id);
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(service.getOwnApplication).not.toHaveBeenCalled();
  });

  it("never answers a result that breaks the contract (500)", async () => {
    service.getOwnApplication.mockResolvedValue({
      ...rejected,
      status: "approved",
    } as never);

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
  });
});
