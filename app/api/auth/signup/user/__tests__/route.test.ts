import { resolveCurrentUser } from "@/src/core/auth/server/auth-session";
import { writeAuthCookies } from "@/src/core/auth/server/auth-cookies";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import type { SignUpResponseDto } from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
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
// Creating the pending account and sending the code are the service's job, tested there.
jest.mock("@/src/features/auth/server", () => ({
  authService: { signUpUser: jest.fn() },
}));
const service = jest.mocked(authService);

const PATH = "/api/auth/signup/user";
const PASSWORD = "Sign$up2026";

const valid = {
  firstName: "Ann",
  lastName: "Lee",
  email: "ann@example.test",
  password: PASSWORD,
  confirmPassword: PASSWORD,
};
const answer: SignUpResponseDto = {
  email: "ann@example.test",
  verificationEmailSent: true,
  verificationCodeExpiresInMinutes: 5,
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.signUpUser.mockResolvedValue(answer);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/signup/user", () => {
  it("creates the pending account: 201 with only the email and the code's status", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: answer });
  });

  it("hands the service trimmed names, a lower-cased email and the optional profile fields", async () => {
    await send({
      ...valid,
      firstName: "  Ann ",
      email: " Ann@Example.TEST",
      phone: " 9876543210 ",
      city: " Pune ",
      postalCode: " 411016 ",
    });

    expect(service.signUpUser).toHaveBeenCalledWith({
      ...valid,
      firstName: "Ann",
      email: "ann@example.test",
      phone: "9876543210",
      city: "Pune",
      postalCode: "411016",
    });
  });

  it("drops fields the client may not set (role, status)", async () => {
    await send({ ...valid, role: "admin", status: "active" });

    expect(service.signUpUser).toHaveBeenCalledWith(valid);
  });

  it("answers the same shape for an email that already has an account, so it reveals nothing", async () => {
    const fresh = await send(valid);
    const known = await send({ ...valid, email: "taken@example.test" });

    expect(known.status).toBe(fresh.status);
    expect(Object.keys((await body<{ data: object }>(known)).data)).toEqual(
      Object.keys((await body<{ data: object }>(fresh)).data),
    );
  });

  it("never answers an id or the password, even if the service result carried them", async () => {
    service.signUpUser.mockResolvedValue({
      ...answer,
      id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      password: PASSWORD,
    } as never);

    const res = await send(valid);
    const text = await res.text();

    expect(res.status).toBe(201);
    expect(text).not.toContain("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
    expect(text).not.toContain(PASSWORD);
  });

  it("starts no session: no auth cookies are written", async () => {
    await send(valid);

    expect(writeAuthCookies).not.toHaveBeenCalled();
  });

  it("works without a session: nobody is looked up", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
  });

  it("counts the caller's IP (the first x-forwarded-for entry) against the auth-ip limit", async () => {
    await send(valid, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(assertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("answers 429 with Retry-After when the IP limit is reached, and creates nothing", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.signUpUser).not.toHaveBeenCalled();
  });

  it.each([
    ["no first name", { ...valid, firstName: undefined }],
    ["a blank last name", { ...valid, lastName: "   " }],
    ["an address that is not an email", { ...valid, email: "ann" }],
    [
      "a weak password",
      { ...valid, password: "weakpass", confirmPassword: "weakpass" },
    ],
    [
      "passwords that do not match",
      { ...valid, confirmPassword: "Other$Pass1" },
    ],
    ["a phone number that is not one", { ...valid, phone: "call me" }],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.signUpUser).not.toHaveBeenCalled();
  });

  it("never echoes the password in a validation error", async () => {
    const res = await send({ ...valid, confirmPassword: "Other$Pass1" });

    expect(await res.text()).not.toContain(PASSWORD);
  });

  it("blocks a request from another site (403) before anything is created", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.signUpUser).not.toHaveBeenCalled();
  });

  it("a failure is a generic 500 that echoes neither the email nor the password", async () => {
    service.signUpUser.mockRejectedValue(
      new Error(`insert failed for ann@example.test ${PASSWORD}`),
    );

    const res = await send(valid);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("ann@example.test");
    expect(text).not.toContain(PASSWORD);
  });
});
