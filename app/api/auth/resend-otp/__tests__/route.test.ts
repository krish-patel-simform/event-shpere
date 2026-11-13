import { NextRequest } from "next/server";
import { authService } from "@/src/features/auth/server";
import { POST } from "../route";

// The service, cookies and sessions stay out of the test: only the route's decisions are checked.
jest.mock("@/src/features/auth/server", () => ({
  authService: { resendOtp: jest.fn() },
}));
jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
}));
const mockResendOtp = jest.mocked(authService.resendOtp);

function resend(body: string, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/auth/resend-otp", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", ...headers },
    }),
    { params: Promise.resolve({}) },
  );
}

beforeEach(() => {
  mockResendOtp.mockReset();
  mockResendOtp.mockResolvedValue(undefined);
});

describe("POST /api/auth/resend-otp", () => {
  it("answers 204 with no body, and passes the email on trimmed and lowercased", async () => {
    const res = await resend(JSON.stringify({ email: "  Ann@Example.TEST " }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockResendOtp).toHaveBeenCalledWith({ email: "ann@example.test" });
  });

  it("answers the same 204 whatever the service decided (sent, no account, or cooldown)", async () => {
    // The service resolves to nothing in every case; the route must not add a difference.
    const first = await resend(JSON.stringify({ email: "ann@example.test" }));
    const second = await resend(
      JSON.stringify({ email: "nobody@example.test" }),
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(await first.text()).toBe(await second.text());
  });

  it("400 for an address that is not an email, and the service is never called", async () => {
    const res = await resend(JSON.stringify({ email: "not-an-email" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mockResendOtp).not.toHaveBeenCalled();
  });

  it("400 for a missing email or a body that is not JSON", async () => {
    expect((await resend(JSON.stringify({}))).status).toBe(400);
    expect((await resend("{not json")).status).toBe(400);
    expect(mockResendOtp).not.toHaveBeenCalled();
  });

  it("a failure (Redis down) is a generic 500 that does not echo the email", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockResendOtp.mockRejectedValue(new Error("Redis down"));

    const res = await resend(JSON.stringify({ email: "ann@example.test" }));
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(body).error.code).toBe("INTERNAL_ERROR");
    expect(body).not.toContain("ann@example.test");
    log.mockRestore();
  });

  it("refuses a cross-site request (CSRF), before any email is sent", async () => {
    const res = await resend(JSON.stringify({ email: "ann@example.test" }), {
      origin: "https://evil.example",
    });

    expect(res.status).toBe(403);
    expect(mockResendOtp).not.toHaveBeenCalled();
  });
});
