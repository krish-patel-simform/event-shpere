import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { env } from "../../../config/env";

export type EmailOtp = {
  /** The 6 digits: go in the email only. Never stored, never returned by the API. */
  otp: string;
  /** What Redis stores (emailOtpStore); Redis's TTL is the expiry. */
  otpHash: string;
};

/**
 * HMAC with a server secret, not a plain SHA-256: there are only 1M six-digit codes, so a
 * plain hash read from Redis is reversed by trying them all. The email is mixed in so a
 * code only works for the address it was sent to. Signup stores it; verify-email recomputes it.
 */
export function hashEmailOtp(email: string, otp: string): string {
  return createHmac("sha256", env.AUTH_JWT_SECRET)
    .update(`${email}:${otp}`)
    .digest("hex");
}

/** A new 6-digit code for `email`. Pure: saving it is the store's job. */
export function createEmailOtp(email: string): EmailOtp {
  // randomInt is cryptographically secure (Math.random is not); the max is exclusive.
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { otp, otpHash: hashEmailOtp(email, otp) };
}
