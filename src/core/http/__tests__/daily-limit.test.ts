import { assertUnderDailyLimit } from "../daily-limit";
import { RateLimitError } from "../errors";

const DAY_SECONDS = 24 * 60 * 60;
const KEY = "daily-limit:event:create:org-1";

// A tiny in-memory stand-in for Redis. It has ONLY eval, no incr/expire: if the limiter went
// back to two separate commands, these tests would fail. The fake does what the Lua script
// does: count, and set the expiry when the key is new or has none (TTL -1 in Redis, no entry here).
const mockCounts = new Map<string, number>();
const mockTtls = new Map<string, number>();
const mockRedis = {
  eval: jest.fn(
    // Promise<unknown>: like ioredis, which does not know what a script answers.
    async (
      _script: string,
      _numKeys: number,
      key: string,
      seconds: number,
    ): Promise<unknown> => {
      const used = (mockCounts.get(key) ?? 0) + 1;
      mockCounts.set(key, used);
      if (used === 1 || !mockTtls.has(key)) mockTtls.set(key, seconds);
      return used;
    },
  ),
};
jest.mock("../../redis/redis", () => ({ getRedis: () => mockRedis }));

beforeEach(() => {
  mockCounts.clear();
  mockTtls.clear();
  jest.clearAllMocks();
});

describe("assertUnderDailyLimit", () => {
  it("allows the calls up to the limit", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 2);
    await expect(
      assertUnderDailyLimit("event:create", "org-1", 2),
    ).resolves.toBeUndefined();
  });

  it("refuses the call after the limit with a 429 RateLimitError", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 1);

    const error = await assertUnderDailyLimit("event:create", "org-1", 1).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.status).toBe(429);
    expect(error.message).toBe(
      "You reached today's limit of 1. Try again tomorrow.",
    );
  });

  it("counts and sets the expiry in ONE command (nothing can happen between the two)", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 5);

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, seconds] = mockRedis.eval.mock.calls[0];
    expect(numKeys).toBe(1);
    expect(key).toBe(KEY);
    expect(seconds).toBe(DAY_SECONDS);
    // The counting and the expiry are in the same script.
    expect(script).toContain("INCR");
    expect(script).toContain("EXPIRE");
  });

  it("starts the 24 hour clock on the first call", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 5);

    expect(mockCounts.get(KEY)).toBe(1);
    expect(mockTtls.get(KEY)).toBe(DAY_SECONDS);
  });

  it("does not restart the clock on later calls (the limit is a day from the FIRST use)", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 5);
    mockTtls.set(KEY, 5_000); // most of the day has passed

    await assertUnderDailyLimit("event:create", "org-1", 5);

    expect(mockTtls.get(KEY)).toBe(5_000);
  });

  it("gives a counter that has no expiry its expiry back (a lost EXPIRE no longer blocks forever)", async () => {
    // What the old two-command version could leave behind: a counter with no expiry.
    mockCounts.set(KEY, 7);

    await assertUnderDailyLimit("event:create", "org-1", 20);

    expect(mockCounts.get(KEY)).toBe(8);
    expect(mockTtls.get(KEY)).toBe(DAY_SECONDS);
  });

  it("repairs a stuck counter even when it refuses the call, so tomorrow it unlocks", async () => {
    mockCounts.set(KEY, 20); // already at the limit, and no expiry

    await expect(
      assertUnderDailyLimit("event:create", "org-1", 20),
    ).rejects.toBeInstanceOf(RateLimitError);

    expect(mockTtls.get(KEY)).toBe(DAY_SECONDS);
  });

  it("counts each organizer and each action separately", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 1);

    await expect(
      assertUnderDailyLimit("event:create", "org-2", 1),
    ).resolves.toBeUndefined();
    await expect(
      assertUnderDailyLimit("speaker:invite", "org-1", 1),
    ).resolves.toBeUndefined();
  });

  it("fails closed: when Redis is down the call is refused, never let through", async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error("Redis is down"));

    await expect(
      assertUnderDailyLimit("event:create", "org-1", 20),
    ).rejects.toThrow("Redis is down");
  });

  it("refuses when Redis answers something that is not a number (never counts it as under the limit)", async () => {
    mockRedis.eval.mockResolvedValueOnce("not a number");

    // NaN > limit is false, so this would let the call through: it must not be silent.
    await expect(
      assertUnderDailyLimit("event:create", "org-1", 20),
    ).rejects.toThrow();
  });
});
