import type { OrganizerRejectedJob } from "../schemas/email-jobs.schemas";
import type { RenderedEmail } from "./account-setup.template";
import { escapeHtml } from "./escape-html";

/** Sent after an admin rejects the organizer application, with the admin's reason. */
export function organizerRejectedEmail(
  data: Omit<OrganizerRejectedJob, "to">,
): RenderedEmail {
  // Name, organization and reason were typed by people: escape them before putting them into
  // HTML. The reason keeps its line breaks.
  const name = escapeHtml(data.firstName);
  const organization = escapeHtml(data.organizationName);
  const reason = escapeHtml(data.reason).replace(/\r?\n/g, "<br>");
  const subject = "Your EventSphere organizer application";

  const html = `
<p>Hi ${name},</p>
<p>Thank you for applying to organize events on EventSphere. After reviewing the application for <strong>${organization}</strong>, we are unable to approve it.</p>
<p><strong>Reason:</strong><br>${reason}</p>
<p>Your account still works as an attendee account: you can <a href="${data.loginUrl}">log in</a> to browse and register for events.</p>
<p>If you think this is a mistake, reply to this email or contact support.</p>
`.trim();

  const text = [
    `Hi ${data.firstName},`,
    "",
    `Thank you for applying to organize events on EventSphere. After reviewing the application for ${data.organizationName}, we are unable to approve it.`,
    "",
    "Reason:",
    data.reason,
    "",
    "Your account still works as an attendee account: you can log in to browse and register for events.",
    data.loginUrl,
    "",
    "If you think this is a mistake, reply to this email or contact support.",
  ].join("\n");

  return { subject, html, text };
}
