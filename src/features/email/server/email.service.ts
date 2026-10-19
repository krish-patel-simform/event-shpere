import "server-only";
import { Resend } from "resend";
import { env } from "../../../config/env";
import type { RenderedEmail } from "../templates/account-setup.template";

export type OutgoingEmail = RenderedEmail & { to: string };

let resend: Resend | undefined;

function getResend(): { client: Resend; from: string } {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("Set RESEND_API_KEY and EMAIL_FROM in .env to send emails");
  }
  resend ??= new Resend(env.RESEND_API_KEY);
  return { client: resend, from: env.EMAIL_FROM };
}

/**
 * Delivers one email through Resend. Throws on failure so the queue retries the job.
 * `idempotencyKey` (the job id) makes a retry after a timeout never send a duplicate.
 */
export async function sendEmail(
  email: OutgoingEmail,
  options: { idempotencyKey?: string } = {},
): Promise<void> {
  const { client, from } = getResend();

  // Resend does not throw: it returns { data, error }.
  const { error } = await client.emails.send(
    {
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    { idempotencyKey: options.idempotencyKey },
  );

  if (error) {
    throw new Error(`Resend failed (${error.name}): ${error.message}`);
  }
}
