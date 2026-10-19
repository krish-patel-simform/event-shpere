import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getRedis } from "../../../core/redis/redis";
import { EMAIL_OTP_MAX_ATTEMPTS, EMAIL_OTP_TTL_MINUTES } from "../constants";

// One set of keys per (lowercase) email. Verify-email and resend add the attempts counter
// and the resend cooldown under the same prefix.
const KEY_PREFIX = "otp:email-verify";
const otpKey = (email: string) => `${KEY_PREFIX}:${email}`;
const attemptsKey = (email: string) => `${KEY_PREFIX}:attempts:${email}`;

// Constant-time compare: `===` stops at the first different character, and that timing
// difference can leak how much of a guess was right.
function isSameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Redis access for email OTPs. Stores only the hash; Redis deletes it at the TTL. */
export const emailOtpStore = {
  /**
   * Saves a new code for `email`. Overwrites any earlier one, so an older emailed code stops
   * working, and resets the wrong-attempts counter because this is a fresh code.
   */
  async save(email: string, otpHash: string): Promise<void> {
    const redis = getRedis();
    await redis.set(otpKey(email), otpHash, "EX", EMAIL_OTP_TTL_MINUTES * 60);
    await redis.del(attemptsKey(email));
  },

  /**
   * True only for the current, unexpired, unused code. A hash cannot be decoded, so the
   * caller hashes what the user typed (hashEmailOtp) and this compares the two hashes.
   */
  async verify(email: string, otpHash: string): Promise<boolean> {
    const redis = getRedis();

    // null = expired (TTL), never sent, already used, or deleted after too many wrong tries.
    const storedHash = await redis.get(otpKey(email));
    if (!storedHash) return false;

    if (!isSameHash(storedHash, otpHash)) {
      const attempts = await redis.incr(attemptsKey(email)); // creates the key at 1
      if (attempts === 1) {
        await redis.expire(attemptsKey(email), EMAIL_OTP_TTL_MINUTES * 60);
      }
      // Too many wrong codes: delete it, so all 1M codes can never be tried.
      if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
        await redis.del(otpKey(email), attemptsKey(email));
      }
      return false;
    }

    // DEL returns how many keys it removed: if two requests send the right code at once,
    // only one gets 1, so the code works exactly once.
    const deleted = await redis.del(otpKey(email));
    await redis.del(attemptsKey(email));
    return deleted === 1;
  },
};

export type EmailOtpStore = typeof emailOtpStore;
