import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError, NotFoundError, RateLimitError } from "@/src/core/http";
import { userService } from "@/src/features/users/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../../../../__fixtures__/route-test";
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
// The invite rules (only pending accounts, 60 s cooldown) have their own tests.
jest.mock("@/src/features/users/server", () => ({
  userService: { resendInvite: jest.fn() },
}));
const service = jest.mocked(userService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e48";
const PATH = `/api/admin/users/${USER_ID}/resend-invite`;
const params = { userId: USER_ID };

const invite = {
  setupEmailQueued: true,
  expiresAt: "2026-11-25T09:00:00.000Z",
};

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.resendInvite.mockResolvedValue(invite);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/users/[userId]/resend-invite", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("re-sends the invite: 200 with when the new link expires", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: invite });
    expect(service.resendInvite).toHaveBeenCalledWith(USER_ID);
  });

  it("never answers the setup link, even if the service returns one", async () => {
    service.resendInvite.mockResolvedValue({
      ...invite,
      token: "secret-setup-token",
    } as never);

    const res = await send();

    expect(res.status).toBe(200);
    expect(JSON.stringify(await body(res))).not.toContain("secret-setup-token");
  });

  it("refuses a user id that is not a uuid (400)", async () => {
    const res = await call(
      POST,
      "POST",
      "/api/admin/users/nope/resend-invite",
      {
        params: { userId: "nope" },
      },
    );

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("refuses a caller with only USER_VIEW (403)", async () => {
    signInAs(userWith(["USER_VIEW"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before sending anything", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.resendInvite).not.toHaveBeenCalled();
  });

  it("passes on the service's 404 for an unknown user", async () => {
    service.resendInvite.mockRejectedValue(new NotFoundError("User not found"));

    const res = await send();

    expect(res.status).toBe(404);
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
    expect((await body(res)).error?.code).toBe("ACCOUNT_ALREADY_ACTIVE");
  });

  it("passes on the service's 429 cooldown (an invite was sent moments ago)", async () => {
    service.resendInvite.mockRejectedValue(
      new RateLimitError(
        "An invite was sent moments ago. Try again in 42 seconds.",
      ),
    );

    const res = await send();

    expect(res.status).toBe(429);
    expect((await body(res)).error?.code).toBe("RATE_LIMITED");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.resendInvite).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
