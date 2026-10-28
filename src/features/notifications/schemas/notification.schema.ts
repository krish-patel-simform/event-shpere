import { z } from "zod";

// The kinds of notification the page knows how to show. "Personal" ones are addressed to the
// signed-in person; "platform" ones are platform-wide and only reach someone who may act on
// them (see notification-types.ts). To add a kind: add it here AND to NOTIFICATION_TYPE_META.
export const notificationTypes = [
  // personal
  "session_confirmed",
  "travel_reminder",
  "registrations_milestone",
  "co_speaker_accepted",
  "speaker_guide_updated",
  "security_sign_in",
  // platform
  "organizer_application",
  "applications_waiting",
  "invite_expired",
  "user_suspended",
  "event_cancelled",
  "event_sold_out",
  "unverified_accounts",
  "weekly_summary",
] as const;
export const notificationTypeSchema = z.enum(notificationTypes);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

// One notification as the page shows it. Shaped like what the API will return, so wiring it
// later only replaces the sample data: nothing else on the page changes.
export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  /** The bold first sentence ("Your session was confirmed."). */
  title: z.string().min(1),
  /** The rest of the message; may be empty. */
  body: z.string(),
  /** ISO 8601, UTC. */
  createdAt: z.iso.datetime(),
  /** null = unread. */
  readAt: z.iso.datetime().nullable(),
  /** Who or what it came from ("Priya Nair, Speaker Relations", "daily reminder"). */
  source: z.string().optional(),
  /** An in-app path to the thing it is about, with the link text. Both or neither. */
  action: z
    .object({ label: z.string().min(1), href: z.string().startsWith("/") })
    .optional(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;
