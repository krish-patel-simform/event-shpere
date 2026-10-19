import "server-only";
import type { ConnectionOptions } from "bullmq";
import { env } from "../../config/env";

// BullMQ creates its own ioredis clients from these options. Workers wait on Redis with
// blocking commands, so maxRetriesPerRequest must be null (BullMQ warns otherwise).
export const redisConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
};
