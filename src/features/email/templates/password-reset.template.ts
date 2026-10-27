import type { RenderedEmail } from "./account-setup.template";
import { escapeHtml } from "./escape-html";

export type PasswordResetEmailData = {
  firstName: string;
  /** The reset page; its `token` is the one-time secret. */
  resetUrl: string;
  expiresInMinutes: number;
  /** An admin sent this link (not the person's own "forgot password"): the wording says so. */
  sentByAdmin?: boolean;
};

/** One step: open the link and choose a new password. The link works once. */
export function passwordResetEmail(
  data: PasswordResetEmailData,
): RenderedEmail {
  // firstName comes from the signup form: escape it before putting it into HTML.
  const name = escapeHtml(data.firstName);
  const subject = "Reset your EventSphere password";

  // The same link and the same page either way; only who started it differs.
  const intro = data.sentByAdmin
    ? "An EventSphere administrator has started a password reset for your account."
    : "We received a request to reset your EventSphere password.";
  const ignore = data.sentByAdmin
    ? "If you were not expecting this, you can ignore this email: your password stays the same."
    : "If you did not ask for this, you can ignore this email: your password stays the same.";

  const html = `
<p>Hi ${name},</p>
<p>${intro}</p>
<p><a href="${data.resetUrl}">Choose a new password</a></p>
<p>This link works once and expires in ${data.expiresInMinutes} minutes.</p>
<p>${ignore}</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    intro,
    "",
    "Choose a new password:",
    data.resetUrl,
    "",
    `This link works once and expires in ${data.expiresInMinutes} minutes.`,
    "",
    ignore,
  ].join("\n");

  return { subject, html, text };
}
