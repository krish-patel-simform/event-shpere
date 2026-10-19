import type { AccountSetupJob } from "../schemas/email-jobs.schemas";
import { escapeHtml } from "./escape-html";

export type RenderedEmail = { subject: string; html: string; text: string };

/** Step 1: set a password (link valid for `expiresInHours`). Step 2: log in. */
export function accountSetupEmail(
  data: Omit<AccountSetupJob, "to">,
): RenderedEmail {
  const name = escapeHtml(data.firstName);
  const subject = "Set up your EventSphere organizer account";

  const html = `
<p>Hi ${name},</p>
<p>An EventSphere organizer account has been created for you. Two steps to get started:</p>
<h3>Step 1: Set your password</h3>
<p><a href="${data.passwordSetupUrl}">Set your password</a></p>
<p>This link works once and expires in ${data.expiresInHours} hours.</p>
<h3>Step 2: Log in</h3>
<p>After setting your password, <a href="${data.loginUrl}">log in here</a> with your email and new password.</p>
<p>If you were not expecting this email, you can ignore it.</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    "An EventSphere organizer account has been created for you.",
    "",
    "Step 1: Set your password",
    data.passwordSetupUrl,
    `(works once, expires in ${data.expiresInHours} hours)`,
    "",
    "Step 2: Log in",
    data.loginUrl,
    "",
    "If you were not expecting this email, you can ignore it.",
  ].join("\n");

  return { subject, html, text };
}
