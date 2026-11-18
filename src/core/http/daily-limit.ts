import "server-only";
import { incrementWithExpiry } from "../redis/increment-with-expiry";
import { RateLimitError } from "./errors";

const DAY_SECONDS = 24 * 60 * 60;

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
  const used = await incrementWithExpiry(
    `daily-limit:${action}:${ownerId}`,
    DAY_SECONDS,
  );

  if (used > limit) {
    throw new RateLimitError(
      `You reached today's limit of ${limit}. Try again tomorrow.`,
    );
  }
}

export type AssertUnderDailyLimit = typeof assertUnderDailyLimit;
