import {
  resolveCurrentUser,
  type AuthTokens,
} from "@/src/core/auth/server/auth-session";
import { writeAuthCookies } from "@/src/core/auth/server/auth-cookies";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  ForbiddenError,
  RateLimitError,
  UnauthorizedError,
} from "@/src/core/http";
import type { AuthUserDto } from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
} from "../../../__fixtures__/route-test";
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The login rules (attempt counter, dummy hash, account state) have their own tests.
jest.mock("@/src/features/auth/server", () => ({
  authService: { login: jest.fn() },
}));
const service = jest.mocked(authService);

const PATH = "/api/auth/login";
const PASSWORD = "Sup3r$ecretPass";

const user: AuthUserDto = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  firstName: "Ann",
  lastName: "Lee",
  email: "ann@example.test",
  role: "user",
};
const tokens: AuthTokens = {
  accessToken: {
    token: "new-access",
    expiresAt: new Date("2026-11-22T10:15:00Z"),
  },
  refreshToken: {
    token: "new-refresh",
    expiresAt: new Date("2026-11-29T10:00:00Z"),
  },
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.login.mockResolvedValue({ user, tokens });
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/login", () => {
  it("signs in: 200 with who signed in, and the token pair is written to the cookies", async () => {
    const res = await send({ email: "ann@example.test", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: user });
    expect(writeAuthCookies).toHaveBeenCalledWith(tokens);
  });

  it("hands the service the trimmed, lower-cased email, the password and the user agent", async () => {
    await send(
      { email: "  Ann@Example.TEST ", password: PASSWORD },
      { "user-agent": "Jest/1.0" },
    );

    expect(service.login).toHaveBeenCalledWith(
      { email: "ann@example.test", password: PASSWORD },
      "Jest/1.0",
    );
  });

  it("hands the service a null user agent when the browser sends none", async () => {
    await send({ email: "ann@example.test", password: PASSWORD });

    expect(service.login).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("answers only the public fields, even if the service result carried more", async () => {
    service.login.mockResolvedValue({
      user: { ...user, passwordHash: "$argon2id$secret" } as never,
      tokens,
    });

    const res = await send({ email: "ann@example.test", password: PASSWORD });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("$argon2id$secret");
    // The tokens travel only in the cookies, never in the body.
    expect(text).not.toContain("new-access");
    expect(text).not.toContain("new-refresh");
  });

  it("works without a session: nobody is looked up", async () => {
    const res = await send({ email: "ann@example.test", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the auth-ip limit", async () => {
    await send(
      { email: "ann@example.test", password: PASSWORD },
      { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    );

    expect(assertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("answers 429 with Retry-After when the IP limit is reached, without trying the password", async () => {
    rateLimited();

    const res = await send({ email: "ann@example.test", password: PASSWORD });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.login).not.toHaveBeenCalled();
    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it.each([
    ["no email", { password: PASSWORD }],
    ["an address that is not an email", { email: "ann", password: PASSWORD }],
    ["no password", { email: "ann@example.test" }],
    ["an empty password", { email: "ann@example.test", password: "" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.login).not.toHaveBeenCalled();
    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("never echoes the password in a validation error", async () => {
    const res = await send({ email: "not-an-email", password: PASSWORD });

    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain(PASSWORD);
  });

  it("passes on the service's 401 for a wrong password, writes no cookies and leaks no secret", async () => {
    service.login.mockRejectedValue(
      new UnauthorizedError("Invalid email or password"),
    );

    const res = await send({ email: "ann@example.test", password: PASSWORD });
    const text = await res.text();

    expect(res.status).toBe(401);
    expect(JSON.parse(text)).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Invalid email or password" },
    });
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain("ann@example.test");
    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("passes on a 403 with its code (email not verified yet)", async () => {
    service.login.mockRejectedValue(
      new ForbiddenError(
        "Verify your email with the code we sent you first",
        "EMAIL_NOT_VERIFIED",
      ),
    );

    const res = await send({ email: "ann@example.test", password: PASSWORD });

    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe("EMAIL_NOT_VERIFIED");
    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("passes on the per-email lock-out (429) with its Retry-After", async () => {
    service.login.mockRejectedValue(
      new RateLimitError("Too many login attempts. Try again later.", 600),
    );

    const res = await send({ email: "ann@example.test", password: PASSWORD });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("600");
  });

  it("blocks a request from another site (403) before the password is tried", async () => {
    const res = await send(
      { email: "ann@example.test", password: PASSWORD },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.login).not.toHaveBeenCalled();
    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("a failure is a generic 500 that echoes neither the email nor the password", async () => {
    service.login.mockRejectedValue(
      new Error(`db down for ann@example.test / ${PASSWORD}`),
    );

    const res = await send({ email: "ann@example.test", password: PASSWORD });
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("ann@example.test");
    expect(text).not.toContain(PASSWORD);
  });
});
