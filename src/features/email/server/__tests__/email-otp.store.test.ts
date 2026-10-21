import { EMAIL_OTP_MAX_ATTEMPTS, EMAIL_OTP_TTL_MINUTES } from "../../constants";
import { emailOtpStore } from "../email-otp.store";

// A tiny in-memory stand-in for the Redis commands the store uses, so the tests need no server.
const mockData = new Map<string, string>();
const mockTtls = new Map<string, number>();
const mockRedis = {
  set: jest.fn(
    async (key: string, value: string, _mode: "EX", seconds: number) => {
      mockData.set(key, value);
      mockTtls.set(key, seconds);
      return "OK";
    },
  ),
  get: jest.fn(async (key: string) => mockData.get(key) ?? null),
  del: jest.fn(async (...keys: string[]) => {
    let removed = 0;
    for (const key of keys) if (mockData.delete(key)) removed += 1;
    return removed;
  }),
  incr: jest.fn(async (key: string) => {
    const next = Number(mockData.get(key) ?? "0") + 1;
    mockData.set(key, String(next));
    return next;
  }),
  expire: jest.fn(async (key: string, seconds: number) => {
    mockTtls.set(key, seconds);
    return 1;
  }),
};
jest.mock("../../../../core/redis/redis", () => ({
  getRedis: () => mockRedis,
}));

// Valid 32-byte hex strings, like the HMAC the real code produces.
const RIGHT = "aa".repeat(32);
const WRONG = "bb".repeat(32);
const email = "olga@acme.test";
const otpKey = `otp:email-verify:${email}`;
const attemptsKey = `otp:email-verify:attempts:${email}`;

beforeEach(() => {
  mockData.clear();
  mockTtls.clear();
  jest.clearAllMocks();
});

describe("emailOtpStore.save", () => {
  it("stores the hash under the email with the configured expiry", async () => {
    await emailOtpStore.save(email, RIGHT);

    expect(mockData.get(otpKey)).toBe(RIGHT);
    expect(mockTtls.get(otpKey)).toBe(EMAIL_OTP_TTL_MINUTES * 60);
  });

  it("replaces an earlier code, so only the newest emailed code works", async () => {
    await emailOtpStore.save(email, WRONG);
    await emailOtpStore.save(email, RIGHT);

    expect(await emailOtpStore.verify(email, WRONG)).toBe(false);
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(true);
  });

  it("resets the wrong-attempts counter, because it is a fresh code", async () => {
    await emailOtpStore.save(email, RIGHT);
    await emailOtpStore.verify(email, WRONG);
    expect(mockData.get(attemptsKey)).toBe("1");

    await emailOtpStore.save(email, RIGHT);

    expect(mockData.has(attemptsKey)).toBe(false);
  });
});

describe("emailOtpStore.verify", () => {
  it("is false when no code was saved, or it expired", async () => {
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(false);
  });

  it("is true for the right code", async () => {
    await emailOtpStore.save(email, RIGHT);
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(true);
  });

  it("works exactly once: the same right code fails the second time", async () => {
    await emailOtpStore.save(email, RIGHT);

    expect(await emailOtpStore.verify(email, RIGHT)).toBe(true);
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(false);
  });

  it("does not let another email's code through", async () => {
    await emailOtpStore.save("ada@acme.test", RIGHT);
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(false);
  });

  it("is false for a wrong code, keeps the real code, and counts the attempt", async () => {
    await emailOtpStore.save(email, RIGHT);

    expect(await emailOtpStore.verify(email, WRONG)).toBe(false);

    expect(mockData.get(attemptsKey)).toBe("1");
    expect(mockData.get(otpKey)).toBe(RIGHT);
  });

  it("gives the attempts counter the same expiry as the code (set once, on the first miss)", async () => {
    await emailOtpStore.save(email, RIGHT);

    await emailOtpStore.verify(email, WRONG);
    await emailOtpStore.verify(email, WRONG);

    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      attemptsKey,
      EMAIL_OTP_TTL_MINUTES * 60,
    );
  });

  it("deletes the code after too many wrong tries, so the right code stops working too", async () => {
    await emailOtpStore.save(email, RIGHT);

    for (let i = 0; i < EMAIL_OTP_MAX_ATTEMPTS; i++) {
      expect(await emailOtpStore.verify(email, WRONG)).toBe(false);
    }

    expect(mockData.has(otpKey)).toBe(false);
    expect(mockData.has(attemptsKey)).toBe(false);
    expect(await emailOtpStore.verify(email, RIGHT)).toBe(false);
  });

  it("still accepts the right code just before the attempt limit is reached", async () => {
    await emailOtpStore.save(email, RIGHT);
    for (let i = 0; i < EMAIL_OTP_MAX_ATTEMPTS - 1; i++)
      await emailOtpStore.verify(email, WRONG);

    expect(await emailOtpStore.verify(email, RIGHT)).toBe(true);
  });

  it("clears the attempts counter after a successful verify", async () => {
    await emailOtpStore.save(email, RIGHT);
    await emailOtpStore.verify(email, WRONG);

    await emailOtpStore.verify(email, RIGHT);

    expect(mockData.has(attemptsKey)).toBe(false);
  });
});
