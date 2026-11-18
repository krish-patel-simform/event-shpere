import {
  LOGIN_ATTEMPTS_WINDOW_SECONDS,
  LOGIN_MAX_ATTEMPTS,
} from "../../constants";
import { loginFailureStore } from "../login-failure.store";

// Stand-ins for the two Redis pieces the store uses, so the tests need no server.
const mockIncrement = jest
  .fn<Promise<number>, [key: string, ttlSeconds: number]>()
  .mockResolvedValue(1);
const mockRedis = {
  ttl: jest.fn<Promise<number>, [key: string]>().mockResolvedValue(0),
  del: jest.fn<Promise<number>, [key: string]>().mockResolvedValue(1),
};
jest.mock("../../../../core/redis/redis", () => ({
  getRedis: () => mockRedis,
}));
jest.mock("../../../../core/redis/increment-with-expiry", () => ({
  incrementWithExpiry: (key: string, ttlSeconds: number) =>
    mockIncrement(key, ttlSeconds),
}));

const email = "ada@example.com";
const key = `rl:login-fail:${email}`;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loginFailureStore.registerAttempt", () => {
  it("counts under one key per email, for the 15 minute window", async () => {
    await loginFailureStore.registerAttempt(email);

    expect(mockIncrement).toHaveBeenCalledWith(
      key,
      LOGIN_ATTEMPTS_WINDOW_SECONDS,
    );
    expect(LOGIN_ATTEMPTS_WINDOW_SECONDS).toBe(900);
  });

  it("lets attempts 1 to MAX through, and never asks for the TTL", async () => {
    for (let attempts = 1; attempts <= LOGIN_MAX_ATTEMPTS; attempts++) {
      mockIncrement.mockResolvedValueOnce(attempts);

      expect(await loginFailureStore.registerAttempt(email)).toEqual({
        locked: false,
      });
    }
    expect(mockRedis.ttl).not.toHaveBeenCalled();
  });

  it("refuses the attempt after MAX and says how long is left of the window", async () => {
    mockIncrement.mockResolvedValueOnce(LOGIN_MAX_ATTEMPTS + 1);
    mockRedis.ttl.mockResolvedValueOnce(420);

    expect(await loginFailureStore.registerAttempt(email)).toEqual({
      locked: true,
      retryAfterSeconds: 420,
    });
    expect(mockRedis.ttl).toHaveBeenCalledWith(key);
  });

  it.each([-1, -2])(
    "still says at least 1 second when Redis answers TTL %i (no expiry, or the key just expired)",
    async (ttl) => {
      mockIncrement.mockResolvedValueOnce(LOGIN_MAX_ATTEMPTS + 1);
      mockRedis.ttl.mockResolvedValueOnce(ttl);

      expect(await loginFailureStore.registerAttempt(email)).toEqual({
        locked: true,
        retryAfterSeconds: 1,
      });
    },
  );

  it("fails closed: when Redis is down the error comes back, never 'not locked'", async () => {
    mockIncrement.mockRejectedValueOnce(new Error("Redis is down"));

    await expect(loginFailureStore.registerAttempt(email)).rejects.toThrow(
      "Redis is down",
    );
  });
});

describe("loginFailureStore.clear", () => {
  it("deletes the counter of that email", async () => {
    await loginFailureStore.clear(email);

    expect(mockRedis.del).toHaveBeenCalledWith(key);
  });
});
