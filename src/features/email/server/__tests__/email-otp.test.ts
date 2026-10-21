import { createEmailOtp, hashEmailOtp } from "../email-otp";

// Only the JWT secret is read (it keys the HMAC); the rest of env is never loaded.
jest.mock("../../../../config/env", () => ({
  env: { AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters" },
}));

describe("hashEmailOtp", () => {
  it("is deterministic: the same email and code always give the same hash", () => {
    expect(hashEmailOtp("olga@acme.test", "123456")).toBe(
      hashEmailOtp("olga@acme.test", "123456"),
    );
  });

  it("is a 64-character hex string (HMAC-SHA256), so the store can compare it as bytes", () => {
    expect(hashEmailOtp("olga@acme.test", "123456")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs per email: a code only works for the address it was sent to", () => {
    expect(hashEmailOtp("olga@acme.test", "123456")).not.toBe(
      hashEmailOtp("ada@acme.test", "123456"),
    );
  });

  it("differs per code", () => {
    expect(hashEmailOtp("olga@acme.test", "123456")).not.toBe(
      hashEmailOtp("olga@acme.test", "123457"),
    );
  });

  it("does not contain the code (it cannot be read back from the hash)", () => {
    expect(hashEmailOtp("olga@acme.test", "123456")).not.toContain("123456");
  });
});

describe("createEmailOtp", () => {
  it("makes a 6-digit numeric code, zero-padded when it is short", () => {
    for (let i = 0; i < 200; i++) {
      expect(createEmailOtp("olga@acme.test").otp).toMatch(/^\d{6}$/);
    }
  });

  it("returns the hash of that same code for that same email", () => {
    const { otp, otpHash } = createEmailOtp("olga@acme.test");
    expect(otpHash).toBe(hashEmailOtp("olga@acme.test", otp));
  });

  it("makes a different code each time", () => {
    const codes = new Set(
      Array.from({ length: 30 }, () => createEmailOtp("olga@acme.test").otp),
    );
    expect(codes.size).toBeGreaterThan(1);
  });
});
