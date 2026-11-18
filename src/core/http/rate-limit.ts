import "server-only";
import { getRedis } from "../redis/redis";
import { RateLimitError } from "./errors";
import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
} from "./rate-limit-policies";
import { describeError } from "./safe-error";
import {
  slidingWindowDecision,
  type SlidingWindowDecision,
} from "./sliding-window";

// Count this window and read the previous one in ONE script: one round trip per request (this
// runs on every API call), and two requests at the same moment cannot both read the same count.
// The expiry is set only when the key is new or has lost it (TTL < 0), so a lost EXPIRE can
// never leave a counter that blocks forever. The current request is counted BEFORE the decision,
// refused ones included, so a caller who keeps hammering stays refused.
// A missing key reads as `false` in Lua, so `false or '0'` is the "no traffic yet" 0.
const COUNT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local previous = tonumber(redis.call('GET', KEYS[2]) or '0')
return { current, previous }
`;

type Counts = { current: number; previous: number };

async function countRequest(
  currentKey: string,
  previousKey: string,
  ttlSeconds: number,
): Promise<Counts> {
  // ioredis types the script's answer as unknown: it is the { current, previous } array.
  const answer = await getRedis().eval(
    COUNT_SCRIPT,
    2,
    currentKey,
    previousKey,
    ttlSeconds,
  );
  if (!Array.isArray(answer) || answer.length !== 2) {
    throw new Error("The rate limit script did not return two counts");
  }
  const current = Number(answer[0]);
  const previous = Number(answer[1]);
  // NaN <= limit is false: an unexpected answer must fail the request, not decide it.
  if (!Number.isInteger(current) || !Number.isInteger(previous)) {
    throw new Error("The rate limit counts are not whole numbers");
  }
  return { current, previous };
}

/**
 * Counts one request for `id` under the named policy and says whether it may go on.
 *
 * Windows are fixed slots on the clock (slot = floor(now / window)), so every server agrees on
 * which one it is and nothing has to be reset: when the slot number changes, the old key just
 * becomes "previous" and expires by itself. Keys: `rl:<policy>:<id>:<slot>`.
 *
 * Redis down or a strange answer: a "closed" policy throws, so the request fails; an "open"
 * policy logs it and lets the request through. The log never holds `id` (an IP, a user id).
 */
export async function consumeRateLimit(
  policyName: RateLimitPolicyName,
  id: string,
  nowMs = Date.now(),
): Promise<SlidingWindowDecision> {
  const { limit, windowSeconds, failMode } = RATE_LIMIT_POLICIES[policyName];

  const windowMs = windowSeconds * 1000;
  const slot = Math.floor(nowMs / windowMs);
  const secondsIntoWindow = (nowMs % windowMs) / 1000;
  const keyPrefix = `rl:${policyName}:${id}`;

  try {
    const { current, previous } = await countRequest(
      `${keyPrefix}:${slot}`,
      `${keyPrefix}:${slot - 1}`,
      // A key is needed in its own window and again as "previous" in the next one.
      2 * windowSeconds,
    );
    return slidingWindowDecision({
      previous,
      current,
      limit,
      windowSeconds,
      secondsIntoWindow,
    });
  } catch (error) {
    if (failMode === "closed") throw error;
    console.error(
      `[rate-limit] ${policyName} unavailable, letting the request through:`,
      describeError(error),
    );
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/**
 * Same check, but a refused request throws a 429 `RateLimitError` that carries how long to wait.
 * One generic message for every policy, so the answer never says which check refused.
 */
export async function assertRateLimit(
  policyName: RateLimitPolicyName,
  id: string,
): Promise<void> {
  const decision = await consumeRateLimit(policyName, id);
  if (!decision.allowed) {
    throw new RateLimitError(
      "Too many requests, try again later",
      decision.retryAfterSeconds,
    );
  }
}

export type AssertRateLimit = typeof assertRateLimit;
