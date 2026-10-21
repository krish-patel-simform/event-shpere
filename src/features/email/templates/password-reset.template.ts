import type { RenderedEmail } from "./account-setup.template";
import { escapeHtml } from "./escape-html";

export type PasswordResetEmailData = {
  firstName: string;
  /** The reset page; its `token` is the one-time secret. */
  resetUrl: string;
  expiresInMinutes: number;
};

/** One step: open the link and choose a new password. The link works once. */
export function passwordResetEmail(data: PasswordResetEmailData): RenderedEmail {
  // firstName comes from the signup form: escape it before putting it into HTML.
  const name = escapeHtml(data.firstName);
  const subject = "Reset your EventSphere password";

  const html = `
<p>Hi ${name},</p>
<p>We received a request to reset your EventSphere password.</p>
<p><a href="${data.resetUrl}">Choose a new password</a></p>
<p>This link works once and expires in ${data.expiresInMinutes} minutes.</p>
<p>If you did not ask for this, you can ignore this email: your password stays the same.</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    "We received a request to reset your EventSphere password.",
    "",
    "Choose a new password:",
    data.resetUrl,
    "",
    `This link works once and expires in ${data.expiresInMinutes} minutes.`,
    "",
    "If you did not ask for this, you can ignore this email: your password stays the same.",
  ].join("\n");

  return { subject, html, text };
}
