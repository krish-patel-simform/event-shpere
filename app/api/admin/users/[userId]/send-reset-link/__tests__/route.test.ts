import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from "@/src/core/http";
import { passwordResetService } from "@/src/features/auth/server";
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
// The reset rules (not an admin, only active, cooldown, the email) have their own tests.
jest.mock("@/src/features/auth/server", () => ({
  passwordResetService: { sendResetLinkToUser: jest.fn() },
}));
const service = jest.mocked(passwordResetService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e43";
const PATH = `/api/admin/users/${USER_ID}/send-reset-link`;
const params = { userId: USER_ID };

const sent = { expiresAt: "2026-11-22T10:00:00.000Z" };

beforeEach(() => {
  resetRouteMocks();
  signInAs(users.admin);
  service.sendResetLinkToUser.mockResolvedValue(sent);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/admin/users/[userId]/send-reset-link", () => {
  const send = (headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { params, headers });

  it("sends the link: 200 with when it expires", async () => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: sent });
    expect(service.sendResetLinkToUser).toHaveBeenCalledWith(USER_ID);
  });

  it("never answers the reset link, even if the service returns one", async () => {
    service.sendResetLinkToUser.mockResolvedValue({
      ...sent,
      resetUrl: "http://localhost/reset-password#token=secret-reset-token",
    } as never);

    const res = await send();

    expect(res.status).toBe(200);
    expect(JSON.stringify(await body(res))).not.toContain("secret-reset-token");
  });

  it("refuses a user id that is not a uuid (400)", async () => {
    const res = await call(
      POST,
      "POST",
      "/api/admin/users/nope/send-reset-link",
      { params: { userId: "nope" } },
    );

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.sendResetLinkToUser).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send();

    expect(res.status).toBe(401);
    expect(service.sendResetLinkToUser).not.toHaveBeenCalled();
  });

  it("refuses a caller with only USER_VIEW (403)", async () => {
    signInAs(userWith(["USER_VIEW"]));

    const res = await send();

    expect(res.status).toBe(403);
    expect(service.sendResetLinkToUser).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before sending anything", async () => {
    const res = await send({ origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.sendResetLinkToUser).not.toHaveBeenCalled();
  });

  it("passes on the service's 403 with its code (an administrator)", async () => {
    service.sendResetLinkToUser.mockRejectedValue(
      new ForbiddenError(
        "An administrator's password cannot be reset by link",
        "CANNOT_RESET_ADMIN",
      ),
    );

    const res = await send();

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("CANNOT_RESET_ADMIN");
  });

  it("passes on the service's 404 for an unknown user", async () => {
    service.sendResetLinkToUser.mockRejectedValue(
      new NotFoundError("User not found"),
    );

    const res = await send();

    expect(res.status).toBe(404);
  });

  it("passes on a 409 with its code when the account is not set up yet", async () => {
    service.sendResetLinkToUser.mockRejectedValue(
      new ConflictError(
        "ACCOUNT_PENDING",
        "This person has not set up their account yet.",
      ),
    );

    const res = await send();

    expect(res.status).toBe(409);
    expect((await body(res)).error?.code).toBe("ACCOUNT_PENDING");
  });

  it("passes on a 503 when the email could not be sent", async () => {
    service.sendResetLinkToUser.mockRejectedValue(
      new ServiceUnavailableError(
        "EMAIL_NOT_SENT",
        "The email could not be sent",
      ),
    );

    const res = await send();

    expect(res.status).toBe(503);
    expect((await body(res)).error?.code).toBe("EMAIL_NOT_SENT");
  });

  it("answers 429 when the write limit is reached", async () => {
    rateLimited();

    const res = await send();

    expect(res.status).toBe(429);
    expect(service.sendResetLinkToUser).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith("user-write", users.admin.id);
  });
});
