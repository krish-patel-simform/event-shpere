import "server-only";
import { getRedis } from "../redis/redis";
import { RateLimitError } from "./errors";

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Lets one owner (an organizer) do one action at most `limit` times per 24 hours.
 * A counter per `action + ownerId` lives in Redis and deletes itself a day after the first
 * use, so the limit is a daily pace, never a lifetime total.
 *
 * Call it before any expensive work (CMS, email), so a refused request costs nothing.
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

  const used = await redis.incr(key);
  // The first use starts the 24 hour clock.
  if (used === 1) await redis.expire(key, DAY_SECONDS);

  if (used > limit) {
    throw new RateLimitError(
      `You reached today's limit of ${limit}. Try again tomorrow.`,
    );
  }
}

export type AssertUnderDailyLimit = typeof assertUnderDailyLimit;
