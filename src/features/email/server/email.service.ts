import "server-only";
import { Resend } from "resend";
import { env } from "../../../config/env";
import type { RenderedEmail } from "../templates/account-setup.template";
import {
  passwordResetEmail,
  type PasswordResetEmailData,
} from "../templates/password-reset.template";
import {
  verificationCodeEmail,
  type VerificationCodeEmailData,
} from "../templates/verification-code.template";

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
      to: env.EMAIL_TO,
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

/**
 * Sends the verification code during the request (no queue): the user is waiting on the
 * screen for it. Throws if Resend fails; the caller decides what to do.
 */
export async function sendVerificationCodeEmail(
  data: VerificationCodeEmailData & { to: string },
): Promise<void> {
  // Dev without Resend: print the code so signup can be tested locally. Never in production.
  if (!env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.info(`[dev] email OTP for ${data.to}: ${data.otp}`);
    return;
  }
  const { to, ...templateData } = data;
  await sendEmail({ to, ...verificationCodeEmail(templateData) });
}

/**
 * Sends the password reset link during the request (no queue): a reset link is time-sensitive,
 * and a queue backed up under load would make the user wait and ask again. Throws if Resend
 * fails; the caller decides what to do.
 */
export async function sendPasswordResetEmail(
  data: PasswordResetEmailData & { to: string },
): Promise<void> {
  // Dev without Resend: print the link so the flow can be tested locally. Never in production.
  if (!env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.info(`[dev] password reset link for ${data.to}: ${data.resetUrl}`);
    return;
  }
  const { to, ...templateData } = data;
  await sendEmail({ to, ...passwordResetEmail(templateData) });
}
