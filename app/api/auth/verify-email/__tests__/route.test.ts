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
// The link + code checks (DB token, Redis code, wrong-try counter) have their own tests.
jest.mock("@/src/features/auth/server", () => ({
  accountActivationService: { verifyEmail: jest.fn() },
}));
const service = jest.mocked(accountActivationService);

const PATH = "/api/auth/verify-email";
const TOKEN = "verify-token-from-the-email-link";

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.verifyEmail.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/verify-email", () => {
  it("activates the account: 204 with no body, the code is trimmed before the service sees it", async () => {
    const res = await send({ token: TOKEN, otp: " 123456 " });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.verifyEmail).toHaveBeenCalledWith({
      token: TOKEN,
      otp: "123456",
    });
  });

  it("never takes an email from the body: the account comes from the token only", async () => {
    await send({ token: TOKEN, otp: "123456", email: "victim@example.test" });

    expect(service.verifyEmail).toHaveBeenCalledWith({
      token: TOKEN,
      otp: "123456",
    });
  });

  it("signs nobody in: no auth cookies are written", async () => {
    await send({ token: TOKEN, otp: "123456" });

    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("works without a session: nobody is looked up", async () => {
    const res = await send({ token: TOKEN, otp: "123456" });

    expect(res.status).toBe(204);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the auth-ip limit", async () => {
    await send(
      { token: TOKEN, otp: "123456" },
      { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    );

    expect(assertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("answers 429 with Retry-After when the IP limit is reached, and no code is tried", async () => {
    rateLimited();

    const res = await send({ token: TOKEN, otp: "123456" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["no token", { otp: "123456" }],
    ["an empty token", { token: "", otp: "123456" }],
    ["no code", { token: TOKEN }],
    ["a 5-digit code", { token: TOKEN, otp: "12345" }],
    ["a code with letters", { token: TOKEN, otp: "12a456" }],
    ["a code sent as a number", { token: TOKEN, otp: 123456 }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });

  it("passes on the service's 400 for a wrong code, without echoing the token or the code", async () => {
    service.verifyEmail.mockRejectedValue(
      new ValidationError("This code is invalid or has expired", {
        fieldErrors: { otp: ["This code is invalid or has expired"] },
      }),
    );

    const res = await send({ token: TOKEN, otp: "987654" });
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(JSON.parse(text).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "This code is invalid or has expired",
      details: {
        fieldErrors: { otp: ["This code is invalid or has expired"] },
      },
    });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("987654");
  });

  it("blocks a request from another site (403) before the code is tried", async () => {
    const res = await send(
      { token: TOKEN, otp: "123456" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });
});
