import { assertUnderDailyLimit } from "../daily-limit";
import { RateLimitError } from "../errors";

// A tiny in-memory stand-in for the two Redis commands the limiter uses.
const mockCounts = new Map<string, number>();
const mockTtls = new Map<string, number>();
const mockRedis = {
  incr: jest.fn(async (key: string) => {
    const next = (mockCounts.get(key) ?? 0) + 1;
    mockCounts.set(key, next);
    return next;
  }),
  expire: jest.fn(async (key: string, seconds: number) => {
    mockTtls.set(key, seconds);
    return 1;
  }),
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

  it("starts the 24 hour clock on the first call only", async () => {
    await assertUnderDailyLimit("event:create", "org-1", 5);
    await assertUnderDailyLimit("event:create", "org-1", 5);

    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      "daily-limit:event:create:org-1",
      24 * 60 * 60,
    );
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
    mockRedis.incr.mockRejectedValueOnce(new Error("Redis is down"));

    await expect(
      assertUnderDailyLimit("event:create", "org-1", 20),
    ).rejects.toThrow("Redis is down");
  });
});
