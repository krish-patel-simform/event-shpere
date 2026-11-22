import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/src/core/http";
import { speakerService } from "@/src/features/speakers/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
import { POST } from "../route";

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
// The service's rules (pending only, cooldown, verified organizer) have their own tests: faked here.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { resendInvite: jest.fn() },
}));
const service = jest.mocked(speakerService);

const SLUG = "sneha-desai-9d8c7b";
const PATH = `/api/speakers/${SLUG}/resend-invite`;
const params = { slug: SLUG };
const result = {
  setupEmailQueued: true,
  expiresAt: "2026-11-25T09:00:00.000Z",
};

const send = (headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { params, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.organizer);
  service.resendInvite.mockResolvedValue(result);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/speakers/[slug]/resend-invite", () => {
  it("sends a new invite: 200 with when the link expires", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: result });
  });

  it("hands the service the slug and the caller", async () => {
    await send();

    expect(service.resendInvite).toHaveBeenCalledWith(SLUG, users.organizer);
  });

  it("lets an admin resend too", async () => {
    signInAs(users.admin);

    const res = await send();

    expect(res.status).toBe(200);
    expect(service.resendInvite).toHaveBeenCalledWith(SLUG, users.admin);
  });

  it("needs only SPEAKER_CREATE", async () => {
    signInAs(userWith([PERMISSION.SPEAKER_CREATE]));

    const res = await send();

    expect(res.status).toBe(200);
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it.each([
    ["a user", users.user],
    ["a speaker", users.speaker],
  ])("refuses %s without SPEAKER_CREATE (403)", async (_name, user) => {
    signInAs(user);

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("refuses a slug that is not one (400) without asking the service", async () => {
    const res = await call(
      POST,
      "POST",
      "/api/speakers/Bad Slug/resend-invite",
      {
        params: { slug: "Bad Slug" },
      },
    );

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown speaker", async () => {
    service.resendInvite.mockRejectedValue(
      new NotFoundError("Speaker not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on the service's 403 for an organizer not approved yet", async () => {
    service.resendInvite.mockRejectedValue(new ForbiddenError());

    const res = await send();

    expect(res.status).toBe(403);
  });

  it("passes on a 409 with its code when the account is already set up", async () => {
    service.resendInvite.mockRejectedValue(
      new ConflictError(
        "ACCOUNT_ALREADY_ACTIVE",
        "This person has already set up their account.",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "ACCOUNT_ALREADY_ACTIVE",
        message: "This person has already set up their account.",
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.resendInvite).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });

  it("never answers a result that breaks the contract (500, no link leaked)", async () => {
    service.resendInvite.mockResolvedValue({
      setupEmailQueued: true,
      expiresAt: "tomorrow",
      token: "secret-setup-token",
    } as never);

    const res = await send();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("secret-setup-token");
  });
});
