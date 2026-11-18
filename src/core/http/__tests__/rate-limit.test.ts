import { RateLimitError } from "../errors";
import { assertRateLimit, consumeRateLimit } from "../rate-limit";

// The engine runs against fixed test policies (mocked below), so tuning a real limit in
// rate-limit-policies.ts never breaks these tests. "auth-ip" is 10 per 60 s and fails closed;
// "public-read-ip" is 120 per 60 s and fails open.
const IP = "1.2.3.4";
const SLOT = 29_913_841;
const KEY = `rl:auth-ip:${IP}:${SLOT}`;
const PREVIOUS_KEY = `rl:auth-ip:${IP}:${SLOT - 1}`;
// `at(15)` = 15 seconds into the slot, like the worked example in docs/rate-limit-algorithms.md.
const at = (secondsIntoSlot: number, slot = SLOT) =>
  slot * 60_000 + secondsIntoSlot * 1000;

// A tiny in-memory stand-in for Redis. It has ONLY eval: if the engine went back to separate
// INCR / GET commands, these tests would fail. It does what the Lua script does: count this
// window (setting the expiry when the key is new or has none), and read the previous window.
const mockCounts = new Map<string, number>();
const mockTtls = new Map<string, number>();
const mockRedis = {
  eval: jest.fn(
    // Promise<unknown>: like ioredis, which does not know what a script answers.
    async (
      _script: string,
      _numKeys: number,
      currentKey: string,
      previousKey: string,
      ttlSeconds: number,
    ): Promise<unknown> => {
      const current = (mockCounts.get(currentKey) ?? 0) + 1;
      mockCounts.set(currentKey, current);
      if (current === 1 || !mockTtls.has(currentKey)) {
        mockTtls.set(currentKey, ttlSeconds);
      }
      return [current, mockCounts.get(previousKey) ?? 0];
    },
  ),
};
jest.mock("../../redis/redis", () => ({ getRedis: () => mockRedis }));
jest.mock("../rate-limit-policies", () => ({
  RATE_LIMIT_POLICIES: {
    "auth-ip": { limit: 10, windowSeconds: 60, failMode: "closed" },
    "refresh-ip": { limit: 30, windowSeconds: 60, failMode: "open" },
    "public-read-ip": { limit: 120, windowSeconds: 60, failMode: "open" },
  },
}));

const hit = (id: string, nowMs: number) =>
  consumeRateLimit("auth-ip", id, nowMs);

beforeEach(() => {
  mockCounts.clear();
  mockTtls.clear();
  jest.clearAllMocks();
  // The open-policy tests log a failure on purpose: keep the test output clean.
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("consumeRateLimit", () => {
  it("counts and reads both windows in ONE script, with the right keys and expiry", async () => {
    await hit(IP, at(15));

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    const [script, numKeys, currentKey, previousKey, ttlSeconds] =
      mockRedis.eval.mock.calls[0];
    expect(numKeys).toBe(2);
    expect(currentKey).toBe(KEY);
    expect(previousKey).toBe(PREVIOUS_KEY);
    // A key is needed in its own window and again as "previous" in the next one.
    expect(ttlSeconds).toBe(120);
    expect(script).toContain("INCR");
    expect(script).toContain("EXPIRE");
    expect(script).toContain("GET");
  });

  it("allows the requests up to the limit and refuses the next one", async () => {
    for (let i = 1; i <= 10; i++) {
      expect((await hit(IP, at(15))).allowed).toBe(true);
    }

    expect(await hit(IP, at(15))).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 45,
    });
  });

  it("counts the previous window too, less the further we are into this one", async () => {
    mockCounts.set(PREVIOUS_KEY, 8); // 8 * 0.75 = 6 at 15 s in

    // estimated = 6 + 1, 6 + 2, 6 + 3, 6 + 4: all allowed (10 <= 10 is the last one)
    for (let i = 1; i <= 4; i++) {
      expect((await hit(IP, at(15))).allowed).toBe(true);
    }
    // estimated = 6 + 5 = 11
    expect((await hit(IP, at(15))).allowed).toBe(false);
  });

  it("refuses the burst across a window boundary, and forgives old traffic later", async () => {
    for (let i = 1; i <= 10; i++) await hit(IP, at(59));

    // The new window has just started: the old one still counts in full (10 + 1 = 11).
    expect((await hit(IP, at(0, SLOT + 1))).allowed).toBe(false);
    // Near the end of the new window the old one barely counts (10 / 60 + 2 = about 2.2).
    expect((await hit(IP, at(59, SLOT + 1))).allowed).toBe(true);
  });

  it("counts each id and each policy separately", async () => {
    for (let i = 1; i <= 11; i++) await hit(IP, at(15));

    expect((await hit(IP, at(15))).allowed).toBe(false);
    expect((await hit("5.6.7.8", at(15))).allowed).toBe(true);
    expect((await consumeRateLimit("refresh-ip", IP, at(15))).allowed).toBe(
      true,
    );
  });

  it("keeps counting a refused request, so a caller who keeps hammering stays refused", async () => {
    for (let i = 1; i <= 13; i++) await hit(IP, at(15));

    expect(mockCounts.get(KEY)).toBe(13);
  });

  describe("when Redis fails", () => {
    it("fails closed for a closed policy: the same error comes back", async () => {
      mockRedis.eval.mockRejectedValueOnce(new Error("Redis is down"));

      await expect(hit(IP, at(15))).rejects.toThrow("Redis is down");
    });

    it("fails open for an open policy: allows the request and logs without the id", async () => {
      mockRedis.eval.mockRejectedValueOnce(new Error("Redis is down"));

      const decision = await consumeRateLimit(
        "public-read-ip",
        "9.9.9.9",
        at(15),
      );

      expect(decision).toEqual({
        allowed: true,
        remaining: 120,
        retryAfterSeconds: 0,
      });
      expect(console.error).toHaveBeenCalledTimes(1);
      // An IP or user id never goes into a log.
      expect(
        JSON.stringify(jest.mocked(console.error).mock.calls),
      ).not.toContain("9.9.9.9");
    });

    it.each([
      { answer: "not an array" },
      { answer: [1] },
      { answer: ["a", "b"] },
    ])(
      "treats the answer $answer as a failure, never as a decision",
      async ({ answer }) => {
        // NaN <= limit is false: a strange answer must not quietly refuse or allow a request.
        mockRedis.eval.mockResolvedValueOnce(answer);
        await expect(hit(IP, at(15))).rejects.toThrow();

        mockRedis.eval.mockResolvedValueOnce(answer);
        const decision = await consumeRateLimit("public-read-ip", IP, at(15));
        expect(decision.allowed).toBe(true);
      },
    );
  });
});

describe("assertRateLimit", () => {
  it("lets an allowed request pass", async () => {
    jest.spyOn(Date, "now").mockReturnValue(at(15));

    await expect(assertRateLimit("auth-ip", IP)).resolves.toBeUndefined();
  });

  it("refuses with a 429 RateLimitError that says when to come back", async () => {
    jest.spyOn(Date, "now").mockReturnValue(at(15));
    mockCounts.set(KEY, 4);
    mockCounts.set(PREVIOUS_KEY, 8); // estimated = 6 + 5 = 11

    const error = await assertRateLimit("auth-ip", IP).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 45,
      // One generic message for every policy: it never says which check refused.
      message: "Too many requests, try again later",
    });
  });

  it("passes a Redis failure of a closed policy on, so the request fails", async () => {
    mockRedis.eval.mockRejectedValueOnce(new Error("Redis is down"));

    await expect(assertRateLimit("auth-ip", IP)).rejects.toThrow(
      "Redis is down",
    );
  });
});
