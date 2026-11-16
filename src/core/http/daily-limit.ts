import "server-only";
import { getRedis } from "../redis/redis";
import { RateLimitError } from "./errors";

const DAY_SECONDS = 24 * 60 * 60;

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
 * Lets one owner (an organizer) do one action at most `limit` times per 24 hours.
 * A counter per `action + ownerId` lives in Redis and deletes itself a day after the first
 * use, so the limit is a daily pace, never a lifetime total.
 *
 * Call it before any expensive work (CMS, email), so a refused request costs nothing. A request
 * that fails after this call still counts: the work it started was not free.
 * If Redis is down the command throws and the request fails (fail closed); it is never
 * allowed through unchecked.
 */
export async function assertUnderDailyLimit(
  action: string,
  ownerId: string,
  limit: number,
): Promise<void> {
  const redis = getRedis();
  const key = `daily-limit:${action}:${ownerId}`;

  // ioredis types the script's answer as unknown: it is the INCR number.
  const used = Number(await redis.eval(COUNT_SCRIPT, 1, key, DAY_SECONDS));
  // NaN > limit is false: an unexpected answer must fail the request, not let it through.
  if (!Number.isInteger(used)) {
    throw new Error("The daily limit counter did not return a number");
  }

  if (used > limit) {
    throw new RateLimitError(
      `You reached today's limit of ${limit}. Try again tomorrow.`,
    );
  }
}

export type AssertUnderDailyLimit = typeof assertUnderDailyLimit;
