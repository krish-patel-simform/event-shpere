import type { RenderedEmail } from "./account-setup.template";
import { escapeHtml } from "./escape-html";

export type VerificationCodeEmailData = {
  firstName: string;
  otp: string;
  /** The verify-email page; its `token` identifies the signup, the code proves the inbox. */
  verifyUrl: string;
  expiresInMinutes: number;
};

/** Step 1: open the verify link. Step 2: enter the 6-digit code there. */
export function verificationCodeEmail(data: VerificationCodeEmailData): RenderedEmail {
  // firstName comes from the signup form: escape it before putting it into HTML.
  const name = escapeHtml(data.firstName);
  // The code is not in the subject: subjects show up in notifications and inbox lists.
  const subject = "Verify your EventSphere email";

  const html = `
<p>Hi ${name},</p>
<p>Your EventSphere verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${data.otp}</p>
<p><a href="${data.verifyUrl}">Verify your email</a> and enter this code there.</p>
<p>The link and the code expire in ${data.expiresInMinutes} minutes and work once.</p>
<p>If you did not sign up, you can ignore this email.</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    `Your EventSphere verification code is: ${data.otp}`,
    "",
    "Open this link and enter the code there:",
    data.verifyUrl,
    "",
    `The link and the code expire in ${data.expiresInMinutes} minutes and work once.`,
    "",
    "If you did not sign up, you can ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
