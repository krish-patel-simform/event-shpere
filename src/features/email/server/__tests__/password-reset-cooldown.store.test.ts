import { PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS } from "../../constants";
import { passwordResetCooldownStore } from "../password-reset-cooldown.store";

// A tiny in-memory stand-in for the Redis command the store uses, so the tests need no server.
const mockData = new Map<string, string>();
const mockTtls = new Map<string, number>();
const mockRedis = {
  set: jest.fn(
    async (
      key: string,
      value: string,
      _mode: "EX",
      seconds: number,
      only?: "NX",
    ) => {
      // Like Redis: with NX nothing is written when the key already exists, and the answer is null.
      if (only === "NX" && mockData.has(key)) return null;
      mockData.set(key, value);
      mockTtls.set(key, seconds);
      return "OK";
    },
  ),
};
jest.mock("../../../../core/redis/redis", () => ({
  getRedis: () => mockRedis,
}));

const email = "olga@acme.test";
const cooldownKey = `password-reset:cooldown:${email}`;

beforeEach(() => {
  mockData.clear();
  mockTtls.clear();
  jest.clearAllMocks();
});

describe("passwordResetCooldownStore.claim", () => {
  it("lets the first request through and starts the cooldown", async () => {
    expect(await passwordResetCooldownStore.claim(email)).toBe(true);

    expect(mockData.has(cooldownKey)).toBe(true);
    expect(mockTtls.get(cooldownKey)).toBe(
      PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS,
    );
  });

  it("refuses a second request while the cooldown runs", async () => {
    await passwordResetCooldownStore.claim(email);

    expect(await passwordResetCooldownStore.claim(email)).toBe(false);
  });

  it("does not restart the cooldown when it refuses (no extending it by hammering)", async () => {
    await passwordResetCooldownStore.claim(email);
    mockTtls.set(cooldownKey, 12); // some seconds have passed

    await passwordResetCooldownStore.claim(email);

    expect(mockTtls.get(cooldownKey)).toBe(12);
  });

  it("lets a request through again once Redis has deleted the key", async () => {
    await passwordResetCooldownStore.claim(email);
    mockData.delete(cooldownKey); // the expiry passed

    expect(await passwordResetCooldownStore.claim(email)).toBe(true);
  });

  it("is atomic: of several requests at the same moment only one gets through", async () => {
    const answers = await Promise.all([
      passwordResetCooldownStore.claim(email),
      passwordResetCooldownStore.claim(email),
      passwordResetCooldownStore.claim(email),
    ]);

    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it("counts each email address on its own", async () => {
    await passwordResetCooldownStore.claim(email);

    expect(await passwordResetCooldownStore.claim("other@acme.test")).toBe(
      true,
    );
  });

  it("uses a key of its own, apart from the email-verification keys", async () => {
    await passwordResetCooldownStore.claim(email);

    expect([...mockData.keys()]).toEqual([cooldownKey]);
    expect(cooldownKey.startsWith("otp:email-verify")).toBe(false);
  });

  it("stores only a flag, never the email's reset token or any secret", async () => {
    await passwordResetCooldownStore.claim(email);

    expect(mockData.get(cooldownKey)).toBe("1");
  });
});
