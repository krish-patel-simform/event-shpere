import type { CmsAccessJob } from "../schemas/email-jobs.schemas";
import type { RenderedEmail } from "./account-setup.template";
import { escapeHtml } from "./escape-html";

/** Sent after an admin verifies the organizer: activate the content (Strapi) account. */
export function cmsAccessEmail(data: Omit<CmsAccessJob, "to">): RenderedEmail {
  // firstName was typed by an admin: escape it before putting it into HTML.
  const name = escapeHtml(data.firstName);
  const subject = "Set up your EventSphere content access";

  const html = `
<p>Hi ${name},</p>
<p>Your organization has been verified. You can now manage your event content (speakers, announcements and more) in the EventSphere content studio.</p>
<p><a href="${data.registerUrl}">Set up your content access</a></p>
<p>Open the link, choose a password, and you will be signed in. The link works once.</p>
<p>If you were not expecting this email, you can ignore it.</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    "Your organization has been verified. You can now manage your event content (speakers, announcements and more) in the EventSphere content studio.",
    "",
    "Set up your content access:",
    data.registerUrl,
    "",
    "Open the link, choose a password, and you will be signed in. The link works once.",
    "",
    "If you were not expecting this email, you can ignore it.",
  ].join("\n");

  return { subject, html, text };
}
