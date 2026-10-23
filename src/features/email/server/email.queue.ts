import "server-only";
import { Queue } from "bullmq";
import { queueConnection } from "../../../core/redis/redis";
import type { EmailJobName, EmailJobs } from "../schemas/email-jobs.schemas";

export const EMAIL_QUEUE_NAME = "email";

// Created on first use, not at import time, so builds and tests never connect to Redis.
// Kept on globalThis so Next's dev hot-reload does not open a new connection each time.
const globalForQueue = globalThis as unknown as { emailQueue?: Queue };

function getEmailQueue(): Queue {
  globalForQueue.emailQueue ??= new Queue(EMAIL_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3, // provider hiccup → retry
      backoff: { type: "exponential", delay: 5_000 }, // 5s, 10s, 20s
      // Job data can contain a one-time setup link: do not keep it in Redis.
      removeOnComplete: true,
      removeOnFail: { age: 24 * 60 * 60 }, // keep failures 1 day for inspection
    },
  });
  return globalForQueue.emailQueue;
}

async function enqueue<N extends EmailJobName>(
  name: N,
  data: EmailJobs[N],
  options: { jobId?: string } = {},
) {
  await getEmailQueue().add(name, data, options);
}

/** Queued, not sent: the email worker process delivers it. Call only after the DB commit. */
export function enqueueAccountSetupEmail(data: EmailJobs["account-setup"]) {
  return enqueue("account-setup", data);
}

/**
 * One CMS access email per organizer: a fixed jobId makes BullMQ ignore a second add while
 * the first is still queued (BullMQ ids cannot contain ":", hence "-").
 */
export function enqueueCmsAccessEmail(
  data: EmailJobs["cms-access"],
  organizerId: string,
) {
  return enqueue("cms-access", data, { jobId: `cms-access-${organizerId}` });
}
