import { slidingWindowDecision } from "../sliding-window";

// Same numbers as section 5 of docs/rate-limit-algorithms.md: 10 per minute, last minute had 8,
// it is 15 s into this minute, so the weight is 45 / 60 = 0.75 and last minute counts as 6.
const base = {
  previous: 8,
  limit: 10,
  windowSeconds: 60,
  secondsIntoWindow: 15,
};

describe("slidingWindowDecision", () => {
  it("allows a request while the estimate is under the limit", () => {
    // estimated = 8 * 0.75 + 1 = 7
    expect(slidingWindowDecision({ ...base, current: 1 })).toMatchObject({
      allowed: true,
      remaining: 3,
    });
  });

  it("allows a request that lands exactly on the limit (<=, not <)", () => {
    // estimated = 6 + 4 = 10
    expect(slidingWindowDecision({ ...base, current: 4 })).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("refuses the request after the limit, and remaining never goes below 0", () => {
    // estimated = 6 + 5 = 11
    expect(slidingWindowDecision({ ...base, current: 5 })).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    // Far over the limit: still 0, not a negative number.
    expect(slidingWindowDecision({ ...base, current: 50 }).remaining).toBe(0);
  });

  it("refuses the edge burst that a fixed window would allow", () => {
    // 10 requests at 12:00:59, then one at 12:01:00: the new window has just started, so the
    // previous one still counts in full. estimated = 10 * 1.0 + 1 = 11.
    const decision = slidingWindowDecision({
      previous: 10,
      current: 1,
      limit: 10,
      windowSeconds: 60,
      secondsIntoWindow: 0,
    });

    expect(decision.allowed).toBe(false);
  });

  it("lets old traffic fade: the previous window barely counts at the end of this one", () => {
    // weight = 1 / 60, so estimated = 10 / 60 + 1 = about 1.17
    const decision = slidingWindowDecision({
      previous: 10,
      current: 1,
      limit: 10,
      windowSeconds: 60,
      secondsIntoWindow: 59,
    });

    expect(decision).toMatchObject({ allowed: true, remaining: 9 });
  });

  it("counts only this window when the previous one is empty", () => {
    const decision = slidingWindowDecision({
      ...base,
      previous: 0,
      current: 10,
    });

    expect(decision).toMatchObject({ allowed: true, remaining: 0 });
    expect(
      slidingWindowDecision({ ...base, previous: 0, current: 11 }).allowed,
    ).toBe(false);
  });

  it("tells a refused caller to wait for the rest of the window", () => {
    expect(
      slidingWindowDecision({ ...base, current: 5 }).retryAfterSeconds,
    ).toBe(45);
    expect(
      slidingWindowDecision({ ...base, current: 5, secondsIntoWindow: 0 })
        .retryAfterSeconds,
    ).toBe(60);
  });

  it("rounds a partial second up and never answers 0", () => {
    // 0.1 s left: ceil gives 1; and 0 s left must still be 1 (Retry-After: 0 means "retry now").
    expect(
      slidingWindowDecision({ ...base, current: 5, secondsIntoWindow: 59.9 })
        .retryAfterSeconds,
    ).toBe(1);
    expect(
      slidingWindowDecision({ ...base, current: 5, secondsIntoWindow: 60 })
        .retryAfterSeconds,
    ).toBe(1);
  });

  it("works for any window length, not only a minute", () => {
    // 100 per hour, 900 s (15 min) into the hour: weight = 2700 / 3600 = 0.75.
    const decision = slidingWindowDecision({
      previous: 40,
      current: 71,
      limit: 100,
      windowSeconds: 3600,
      secondsIntoWindow: 900,
    });

    // estimated = 40 * 0.75 + 71 = 101
    expect(decision).toMatchObject({ allowed: false, retryAfterSeconds: 2700 });
  });
});
