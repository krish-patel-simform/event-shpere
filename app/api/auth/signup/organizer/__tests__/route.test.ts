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
// Creating the pending organizer and sending the code are the service's job, tested there.
jest.mock("@/src/features/auth/server", () => ({
  authService: { signUpOrganizer: jest.fn() },
}));
const service = jest.mocked(authService);

const PATH = "/api/auth/signup/organizer";
const PASSWORD = "Organ!zer2026";

const valid = {
  firstName: "Ravi",
  lastName: "Mehta",
  email: "ravi@kinetic.test",
  password: PASSWORD,
  confirmPassword: PASSWORD,
  organizationName: "Kinetic Events",
  organizationWebsite: "https://kinetic.test",
};
const answer: SignUpResponseDto = {
  email: "ravi@kinetic.test",
  verificationEmailSent: true,
  verificationCodeExpiresInMinutes: 5,
};

const send = (sent: unknown, headers?: Record<string, string>) =>
  call(POST, "POST", PATH, { body: sent, headers });

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
  service.signUpOrganizer.mockResolvedValue(answer);
});
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/signup/organizer", () => {
  it("creates the pending organizer: 201 with only the email and the code's status", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: answer });
  });

  it("hands the service trimmed names, a lower-cased email and the organization", async () => {
    await send({
      ...valid,
      lastName: " Mehta  ",
      email: " Ravi@Kinetic.TEST ",
      organizationName: "  Kinetic Events ",
    });

    expect(service.signUpOrganizer).toHaveBeenCalledWith(valid);
  });

  it("accepts an organizer without a website", async () => {
    const withoutSite = { ...valid, organizationWebsite: undefined };

    const res = await send(withoutSite);

    expect(res.status).toBe(201);
    expect(service.signUpOrganizer).toHaveBeenCalledWith(withoutSite);
  });

  it("answers the same shape for an email that already has an account, so it reveals nothing", async () => {
    const fresh = await send(valid);
    const known = await send({ ...valid, email: "taken@example.test" });

    expect(known.status).toBe(fresh.status);
    expect(Object.keys((await body<{ data: object }>(known)).data)).toEqual(
      Object.keys((await body<{ data: object }>(fresh)).data),
    );
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
    expect(service.signUpOrganizer).not.toHaveBeenCalled();
  });

  it.each([
    ["no organization name", { ...valid, organizationName: undefined }],
    ["a blank organization name", { ...valid, organizationName: "  " }],
    [
      "a website that is not http(s)",
      { ...valid, organizationWebsite: "javascript:alert(1)" },
    ],
    ["an address that is not an email", { ...valid, email: "ravi" }],
    [
      "passwords that do not match",
      { ...valid, confirmPassword: "Other$Pass1" },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.signUpOrganizer).not.toHaveBeenCalled();
  });

  it("never echoes the password in a validation error", async () => {
    const res = await send({ ...valid, confirmPassword: "Other$Pass1" });

    expect(await res.text()).not.toContain(PASSWORD);
  });

  it("blocks a request from another site (403) before anything is created", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.signUpOrganizer).not.toHaveBeenCalled();
  });
});
