export type SlidingWindowInput = {
  /** Requests counted in the previous window. */
  previous: number;
  /** Requests counted in this window, INCLUDING the one being decided. */
  current: number;
  /** Most requests allowed in one window. */
  limit: number;
  windowSeconds: number;
  /** How far into the current window we are. Can be a decimal (15.4). */
  secondsIntoWindow: number;
};

export type SlidingWindowDecision = {
  allowed: boolean;
  /** Requests left in the window; never below 0. */
  remaining: number;
  /** Seconds a refused caller should wait. At least 1: `Retry-After: 0` makes clients retry at once. */
  retryAfterSeconds: number;
};

/**
 * The math of the sliding window counter, with no Redis and no clock, so every case is a plain
 * unit test. The previous window counts less the further we are into the current one, which is
 * what stops the double burst a fixed window allows around a boundary.
 *
 *   weight    = (windowSeconds - secondsIntoWindow) / windowSeconds
 *   estimated = previous * weight + current
 *   allowed   = estimated <= limit
 *
 * The previous window's requests are assumed to be spread evenly, so `estimated` is a close
 * estimate, not an exact count.
 */
export function slidingWindowDecision({
  previous,
  current,
  limit,
  windowSeconds,
  secondsIntoWindow,
}: SlidingWindowInput): SlidingWindowDecision {
  const secondsLeft = windowSeconds - secondsIntoWindow;
  const weight = secondsLeft / windowSeconds;
  const estimated = previous * weight + current;

  return {
    allowed: estimated <= limit,
    // A refused request pushes `estimated` past the limit: never report a negative number.
    remaining: Math.max(0, limit - Math.floor(estimated)),
    retryAfterSeconds: Math.max(1, Math.ceil(secondsLeft)),
  };
}
