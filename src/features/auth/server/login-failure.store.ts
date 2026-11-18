import "server-only";
import { incrementWithExpiry } from "../../../core/redis/increment-with-expiry";
import { getRedis } from "../../../core/redis/redis";
import {
  LOGIN_ATTEMPTS_WINDOW_SECONDS,
  LOGIN_MAX_ATTEMPTS,
} from "../constants";

// One counter per (lowercase) email. It holds no secret: only a number with an expiry.
const attemptsKey = (email: string) => `rl:login-fail:${email}`;

export type LoginAttempt =
  { locked: false } | { locked: true; retryAfterSeconds: number };

/** Redis access for the login attempt limit: many machines cannot guess one account's password. */
export const loginFailureStore = {
  /**
   * Counts one login attempt for `email`, BEFORE its password is checked. The count is one atomic
   * step, so a burst of parallel guesses cannot all read "0 attempts" while argon2 is busy: the
   * 6th one is refused however many arrive at the same moment. The first attempt starts the
   * window and later ones do not move it, so hammering a locked account never extends the lock.
   *
   * Redis down: this throws and the login fails (fail closed), like the other auth limits.
   */
  async registerAttempt(email: string): Promise<LoginAttempt> {
    const key = attemptsKey(email);
    const attempts = await incrementWithExpiry(
      key,
      LOGIN_ATTEMPTS_WINDOW_SECONDS,
    );
    if (attempts <= LOGIN_MAX_ATTEMPTS) return { locked: false };

    // TTL is -2 (key just expired) or -1 (no expiry): either way waiting 1 second is enough.
    const ttl = await getRedis().ttl(key);
    return { locked: true, retryAfterSeconds: Math.max(1, ttl) };
  },

  /** Forgets the attempts of `email`: called after a correct password. */
  async clear(email: string): Promise<void> {
    await getRedis().del(attemptsKey(email));
  },
};

export type LoginFailureStore = typeof loginFailureStore;
