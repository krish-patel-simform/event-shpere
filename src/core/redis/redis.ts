import "server-only";
import type { ConnectionOptions } from "bullmq";
import { Redis, type RedisOptions } from "ioredis";
import { env } from "../../config/env";

// The ONE place Redis is configured. Two users need opposite retry behavior, so they share
// this base and differ only in maxRetriesPerRequest:
// - BullMQ (queue + worker): workers wait on Redis with blocking commands, so BullMQ
//   requires maxRetriesPerRequest = null (wait forever until Redis is back).
// - Request-time commands (OTP codes, counters): must fail fast, so the route answers with
//   an error instead of hanging while Redis is down.
const baseOptions = {
  connectTimeout: 5_000,
} satisfies RedisOptions;

/** For BullMQ: it creates its own ioredis clients from these options. */
export const queueConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  ...baseOptions,
  maxRetriesPerRequest: null,
};

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    ...baseOptions,
    maxRetriesPerRequest: 1,
    // Connect on the first command, not at import time: builds and tests never touch Redis.
    lazyConnect: true,
  });
  // Without a listener, a connection error is an unhandled 'error' event and crashes the process.
  client.on("error", (error: Error) => {
    console.error("[redis] connection error:", error.message);
  });
  return client;
}

// Next hot-reloads modules in dev; reuse one connection instead of opening a new one each time.
const globalForRedis = globalThis as unknown as { redis?: Redis };

/** The shared client for request-time commands (OTP codes, counters). */
export function getRedis(): Redis {
  globalForRedis.redis ??= createRedisClient();
  return globalForRedis.redis;
}
