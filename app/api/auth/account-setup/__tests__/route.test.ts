import { resolveCurrentUser } from "@/src/core/auth/server/auth-session";
import { writeAuthCookies } from "@/src/core/auth/server/auth-cookies";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ValidationError } from "@/src/core/http";
import { accountActivationService } from "@/src/features/auth/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
} from "../../../__fixtures__/route-test";
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
// Which links work (hash, expiry, single use) is the service's rule, tested there.
jest.mock("@/src/features/auth/server", () => ({
  accountActivationService: { completeAccountSetup: jest.fn() },
}));
const service = jest.mocked(accountActivationService);

const PATH = "/api/auth/account-setup";
const TOKEN = "setup-token-from-the-invite";
const PASSWORD = "Fir$tPassw0rd";
const valid = { token: TOKEN, password: PASSWORD, confirmPassword: PASSWORD };

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.completeAccountSetup.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/account-setup", () => {
  it("activates the account: 204 with no body, the service gets the token and both passwords", async () => {
    const res = await send(valid);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.completeAccountSetup).toHaveBeenCalledWith(valid);
  });

  it("signs nobody in: the person logs in afterwards, so no cookies are written", async () => {
    await send(valid);

    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("works without a session: nobody is looked up", async () => {
    const res = await send(valid);

    expect(res.status).toBe(204);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the auth-ip limit", async () => {
    await send(valid, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(assertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("answers 429 with Retry-After when the IP limit is reached, and activates nothing", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.completeAccountSetup).not.toHaveBeenCalled();
  });

  it.each([
    ["no token", { password: PASSWORD, confirmPassword: PASSWORD }],
    ["a token over 200 characters", { ...valid, token: "t".repeat(201) }],
    [
      "a password without a digit or symbol",
      { token: TOKEN, password: "Password", confirmPassword: "Password" },
    ],
    ["no confirmation", { token: TOKEN, password: PASSWORD }],
    [
      "passwords that do not match",
      { ...valid, confirmPassword: "Other$Pass1" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.completeAccountSetup).not.toHaveBeenCalled();
  });

  it("never echoes the token or the password in a validation error", async () => {
    const res = await send({ ...valid, confirmPassword: "Other$Pass1" });
    const text = await res.text();

    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(PASSWORD);
  });

  it("passes on the service's 400 for an unknown, used or expired link, without the secrets", async () => {
    service.completeAccountSetup.mockRejectedValue(
      new ValidationError("This link is invalid or has expired", {
        fieldErrors: { token: ["This link is invalid or has expired"] },
      }),
    );

    const res = await send(valid);
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(JSON.parse(text).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "This link is invalid or has expired",
      details: {
        fieldErrors: { token: ["This link is invalid or has expired"] },
      },
    });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(PASSWORD);
  });

  it("blocks a request from another site (403) before the link is used", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.completeAccountSetup).not.toHaveBeenCalled();
  });
});
