import { resolveCurrentUser } from "@/src/core/auth/server/auth-session";
import { writeAuthCookies } from "@/src/core/auth/server/auth-cookies";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ValidationError } from "@/src/core/http";
import { passwordResetService } from "@/src/features/auth/server";
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
// The link checks (hash lookup, expiry, single use, same password) have their own tests.
jest.mock("@/src/features/auth/server", () => ({
  passwordResetService: { resetPassword: jest.fn() },
}));
const service = jest.mocked(passwordResetService);

const PATH = "/api/auth/reset-password";
const TOKEN = "reset-token-from-the-email-link";
const PASSWORD = "N3w$ecretPass";
const valid = { token: TOKEN, password: PASSWORD, confirmPassword: PASSWORD };

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.resetPassword.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/reset-password", () => {
  it("sets the new password: 204 with no body, the service gets the token and both passwords", async () => {
    const res = await send(valid);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.resetPassword).toHaveBeenCalledWith(valid);
  });

  it("signs nobody in: no auth cookies are written", async () => {
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

  it("answers 429 with Retry-After when the IP limit is reached, and changes nothing", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["no token", { password: PASSWORD, confirmPassword: PASSWORD }],
    ["an empty token", { ...valid, token: "" }],
    ["no password", { token: TOKEN, confirmPassword: PASSWORD }],
    [
      "a weak password",
      { token: TOKEN, password: "password", confirmPassword: "password" },
    ],
    [
      "passwords that do not match",
      { ...valid, confirmPassword: "Other$Pass1" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it("never echoes the token or the password in a validation error", async () => {
    const res = await send({ ...valid, confirmPassword: "Other$Pass1" });
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain("Other$Pass1");
  });

  it("passes on the service's 400 for a used or expired link, without the token or password", async () => {
    service.resetPassword.mockRejectedValue(
      new ValidationError("This link is invalid or has expired", {
        fieldErrors: { token: ["This link is invalid or has expired"] },
      }),
    );

    const res = await send(valid);
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(JSON.parse(text)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "This link is invalid or has expired",
        details: {
          fieldErrors: { token: ["This link is invalid or has expired"] },
        },
      },
    });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(PASSWORD);
  });

  it("blocks a request from another site (403) before the link is used", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it("a failure is a generic 500 that echoes neither the token nor the password", async () => {
    service.resetPassword.mockRejectedValue(
      new Error(`db down: ${TOKEN} ${PASSWORD}`),
    );

    const res = await send(valid);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(PASSWORD);
  });
});
