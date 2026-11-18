import "server-only";
import { getRedis } from "./redis";

// Count and set the expiry in ONE script: Redis runs a script as a single step, so nothing can
// happen between the two. As two commands (INCR, then EXPIRE) a lost second call left a counter
// with no expiry, and it then climbed to the limit and blocked the owner forever.
// TTL < 0 means "no expiry" (-1), so a counter that is already stuck gets its expiry back on its
// next use. A key that has an expiry is left alone, so the clock still starts at the first use.
const COUNT_SCRIPT = `
local used = redis.call('INCR', KEYS[1])
if used == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return used
`;

/**
 * Adds 1 to the counter at `key` and returns the new count. The first call starts the clock:
 * the key deletes itself `ttlSeconds` later, and later calls do not move that time.
 *
 * Throws if Redis is down or answers something that is not a whole number, so a caller can
 * never mistake a failure for "under the limit".
 */
export async function incrementWithExpiry(
  key: string,
  ttlSeconds: number,
): Promise<number> {
  // ioredis types the script's answer as unknown: it is the INCR number.
  const count = Number(await getRedis().eval(COUNT_SCRIPT, 1, key, ttlSeconds));
  // NaN > limit is false: an unexpected answer must fail the caller, not let it through.
  if (!Number.isInteger(count)) {
    throw new Error("The Redis counter did not return a number");
  }
  return count;
}
