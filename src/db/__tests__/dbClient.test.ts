// The driver and drizzle are replaced: no connection opens, only the pool's settings are checked.
const mockPool = jest.fn().mockImplementation(() => ({ on: jest.fn() }));
jest.mock("@neondatabase/serverless", () => ({
  Pool: function Pool(...args: unknown[]) {
    return mockPool(...args);
  },
}));
jest.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: jest.fn(() => ({})),
}));
jest.mock("../../config/env", () => ({
  env: { POSTGRESS_DB_URL: "postgres://app_user:pw@db.test:5432/app" },
}));
jest.mock("../schemas", () => ({}));

describe("the database pool", () => {
  beforeEach(() => {
    jest.resetModules();
    mockPool.mockClear();
    delete (globalThis as { db?: unknown }).db;
  });

  it("waits for a free connection for a few seconds only, then fails", async () => {
    const { DB_CONNECTION_TIMEOUT_MS } = await import("../dbClient");

    expect(DB_CONNECTION_TIMEOUT_MS).toBe(10_000);
    expect(mockPool).toHaveBeenCalledTimes(1);
    expect(mockPool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionTimeoutMillis: 10_000 }),
    );
  });

  it("leaves room above a slow connect (about 4 s to hosted Neon) and under the browser's 15 s", async () => {
    const { DB_CONNECTION_TIMEOUT_MS } = await import("../dbClient");

    expect(DB_CONNECTION_TIMEOUT_MS).toBeGreaterThanOrEqual(8_000);
    expect(DB_CONNECTION_TIMEOUT_MS).toBeLessThan(15_000);
  });

  it("keeps a small pool per instance, so many instances do not open too many connections", async () => {
    await import("../dbClient");

    expect(mockPool).toHaveBeenCalledWith(expect.objectContaining({ max: 5 }));
  });
});
