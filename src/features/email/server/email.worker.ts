import "server-only";
import { Worker, type Job } from "bullmq";
import { queueConnection } from "../../../core/redis/redis";
import {
  accountSetupJobSchema,
  cmsAccessJobSchema,
  organizerRejectedJobSchema,
} from "../schemas/email-jobs.schemas";
import { accountSetupEmail } from "../templates/account-setup.template";
import { cmsAccessEmail } from "../templates/cms-access.template";
import { organizerRejectedEmail } from "../templates/organizer-rejected.template";
import { EMAIL_QUEUE_NAME } from "./email.queue";
import { sendEmail } from "./email.service";

/** Turns one queued job into one sent email. Throwing makes BullMQ retry it. */
export async function processEmailJob(job: Job): Promise<void> {
  switch (job.name) {
    case "account-setup": {
      const { to, ...data } = accountSetupJobSchema.parse(job.data);
      await sendEmail(
        { to, ...accountSetupEmail(data) },
        { idempotencyKey: `${job.name}/${job.id}` },
      );
      return;
    }
    case "cms-access": {
      const { to, ...data } = cmsAccessJobSchema.parse(job.data);
      await sendEmail(
        { to, ...cmsAccessEmail(data) },
        { idempotencyKey: `${job.name}/${job.id}` },
      );
      return;
    }
    case "organizer-rejected": {
      const { to, ...data } = organizerRejectedJobSchema.parse(job.data);
      await sendEmail(
        { to, ...organizerRejectedEmail(data) },
        { idempotencyKey: `${job.name}/${job.id}` },
      );
      return;
    }
    default:
      throw new Error(`Unknown email job: ${job.name}`);
  }
}

export function startEmailWorker(): Worker {
  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: queueConnection,
    concurrency: 5,
  });

  // Never log job.data: it can contain a one-time setup link.
  worker.on("completed", (job) =>
    console.log(`[email] sent ${job.name} (${job.id})`),
  );
  worker.on("failed", (job, error) =>
    console.error(
      `[email] ${job?.name} (${job?.id}) failed, attempt ${job?.attemptsMade}:`,
      error.message,
    ),
  );
  return worker;
}
