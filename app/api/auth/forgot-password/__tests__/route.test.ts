import { resolveCurrentUser } from "@/src/core/auth/server/auth-session";
import { assertRateLimit } from "@/src/core/http/rate-limit";
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
// Who gets an email (active, not admin, cooldown) is the service's rule, tested there.
jest.mock("@/src/features/auth/server", () => ({
  passwordResetService: { requestReset: jest.fn() },
}));
const service = jest.mocked(passwordResetService);

const PATH = "/api/auth/forgot-password";

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.requestReset.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/forgot-password", () => {
  it("answers 204 with no body and hands the service the trimmed, lower-cased email", async () => {
    const res = await send({ email: "  Ann@Example.TEST " });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(service.requestReset).toHaveBeenCalledWith({
      email: "ann@example.test",
    });
  });

  it("answers exactly the same for an unknown email, so it never reveals who has an account", async () => {
    const known = await send({ email: "ann@example.test" });
    const unknown = await send({ email: "nobody@example.test" });

    expect(unknown.status).toBe(known.status);
    expect(await unknown.text()).toBe(await known.text());
    expect([...unknown.headers.keys()].sort()).toEqual(
      [...known.headers.keys()].sort(),
    );
  });

  it("works without a session: nobody is looked up", async () => {
    const res = await send({ email: "ann@example.test" });

    expect(res.status).toBe(204);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the auth-ip limit", async () => {
    await send(
      { email: "ann@example.test" },
      { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    );

    expect(assertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("answers 429 with Retry-After when the IP limit is reached, and sends nothing", async () => {
    rateLimited();

    const res = await send({ email: "ann@example.test" });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.requestReset).not.toHaveBeenCalled();
  });

  it.each([
    ["no email", {}],
    ["an address that is not an email", { email: "ann" }],
    ["an email that is not a string", { email: 42 }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.requestReset).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON (400)", async () => {
    const res = await call(POST, "POST", PATH, {
      formData: new FormData(),
    });

    expect(res.status).toBe(400);
    expect(service.requestReset).not.toHaveBeenCalled();
  });

  it("blocks a request from another site (403) before anything is sent", async () => {
    const res = await send(
      { email: "ann@example.test" },
      { origin: "https://evil.example" },
    );

    expect(res.status).toBe(403);
    expect(service.requestReset).not.toHaveBeenCalled();
  });

  it("a failure is a generic 500 that does not echo the email", async () => {
    service.requestReset.mockRejectedValue(
      new Error("db down for ann@example.test"),
    );

    const res = await send({ email: "ann@example.test" });
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("ann@example.test");
  });
});
