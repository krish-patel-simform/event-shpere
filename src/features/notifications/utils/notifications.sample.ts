import type { NotificationDto } from "../schemas/notification.schema";
import type { NotificationPreference } from "../types/notification";

// TODO(API): sample data for the notification center until its endpoints exist. The one place
// these notifications live: replace these constants with the API data, not the components. The
// real endpoint returns only what is addressed to the signed-in person; the sample mixes personal
// and platform-wide ones, and the page hides the platform ones from anyone who cannot act on them.

/** The fixed "now" the sample is written against, so the page and its tests read the same. */
export const NOTIFICATIONS_SAMPLE_NOW = "2026-10-27T12:00:00Z";

export const NOTIFICATIONS_SAMPLE: NotificationDto[] = [
  // Today
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c01",
    type: "session_confirmed",
    title: "Your session was confirmed.",
    body: "“Panel: The Future of Frontend Tooling” is scheduled for Fri, 5 Dec at 11:30 in Main Hall.",
    createdAt: "2026-10-27T10:00:00Z",
    readAt: null,
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c02",
    type: "organizer_application",
    title: "New organizer application.",
    body: "Acme Events Pvt Ltd applied. Ananya Rao has verified their email.",
    createdAt: "2026-10-27T09:30:00Z",
    readAt: null,
    action: { label: "Review application", href: "/admin/organizers" },
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c03",
    type: "applications_waiting",
    title: "3 applications have waited more than 7 days:",
    body: "Studio Forty Two, Harbor Tech Talks and Lakeside Conferences.",
    createdAt: "2026-10-27T09:00:00Z",
    readAt: null,
    source: "Daily reminder",
    action: { label: "Open queue", href: "/admin/organizers" },
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c04",
    type: "invite_expired",
    title: "Invite expired.",
    body: "The password setup link for Sneha Desai was not used within 24 hours.",
    createdAt: "2026-10-27T08:15:00Z",
    readAt: null,
    action: { label: "Resend invite", href: "/admin/users" },
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c05",
    type: "travel_reminder",
    title: "Reminder:",
    body: "please confirm your travel and accommodation details by 15 November.",
    createdAt: "2026-10-27T07:00:00Z",
    readAt: null,
    source: "Priya Nair, Speaker Relations",
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c06",
    type: "registrations_milestone",
    title: "Registrations passed 80%",
    body: "for “Scaling Next.js Applications”. 248 of 300 seats are now taken.",
    createdAt: "2026-10-27T05:00:00Z",
    readAt: null,
  },
  // Yesterday
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c07",
    type: "user_suspended",
    title: "Dev Verma was suspended",
    body: "by you. Reason: repeated spam registrations.",
    createdAt: "2026-10-26T17:05:00Z",
    readAt: "2026-10-26T17:10:00Z",
    action: { label: "View user", href: "/admin/users" },
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c08",
    type: "co_speaker_accepted",
    title: "Vikram Mehta",
    body: "accepted your co-speaker invitation for “Scaling Next.js Applications”.",
    createdAt: "2026-10-26T16:20:00Z",
    readAt: "2026-10-26T18:00:00Z",
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c09",
    type: "speaker_guide_updated",
    title: "The organizer updated the speaker guide",
    body: "with new AV and check-in instructions.",
    createdAt: "2026-10-26T11:05:00Z",
    readAt: "2026-10-26T12:00:00Z",
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c10",
    type: "weekly_summary",
    title: "Your weekly platform summary is ready:",
    body: "312 new users and 11% more registrations than the previous period.",
    createdAt: "2026-10-26T08:00:00Z",
    readAt: "2026-10-26T08:30:00Z",
  },
  // Earlier this week
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c11",
    type: "event_cancelled",
    title: "Kinetic Events cancelled “Pune Tech Meetup”.",
    body: "86 registered attendees were notified.",
    createdAt: "2026-10-22T14:30:00Z",
    readAt: "2026-10-22T15:00:00Z",
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c12",
    type: "event_sold_out",
    title: "Cloud Native Engineering Meetup is sold out.",
    body: "All 80 seats are taken.",
    createdAt: "2026-10-21T16:48:00Z",
    readAt: "2026-10-21T17:00:00Z",
  },
  // Earlier
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c13",
    type: "unverified_accounts",
    title: "58 accounts",
    body: "have not verified their email after 7 days.",
    createdAt: "2026-10-17T09:00:00Z",
    readAt: "2026-10-17T10:00:00Z",
    action: { label: "Filter users", href: "/admin/users" },
  },
  {
    id: "5b1f3c20-7a4e-4d1b-8c3a-1e2f3a4b5c14",
    type: "security_sign_in",
    title: "New sign-in to your account from Chrome on Windows.",
    body: "If this was not you, change your password.",
    createdAt: "2026-10-14T09:12:00Z",
    readAt: "2026-10-14T09:30:00Z",
  },
];

// The delivery preferences card. Listed on the page, but saving them is not built yet.
export const NOTIFICATION_PREFERENCES_SAMPLE: NotificationPreference[] = [
  {
    id: "session-status",
    label: "Session status changes",
    audience: "personal",
    email: true,
    push: true,
  },
  {
    id: "organizer-messages",
    label: "Organizer messages",
    audience: "personal",
    email: true,
    push: true,
  },
  {
    id: "registration-milestones",
    label: "Registration milestones",
    audience: "personal",
    email: false,
    push: true,
  },
  {
    id: "security-alerts",
    label: "Security alerts",
    audience: "personal",
    email: true,
    push: true,
  },
  {
    id: "organizer-applies",
    label: "A new organizer applies",
    description: "One email per application",
    audience: "platform",
    email: true,
    push: null,
  },
  {
    id: "applications-waiting",
    label: "Applications wait over 7 days",
    description: "Daily reminder at 09:00",
    audience: "platform",
    email: true,
    push: null,
  },
  {
    id: "invite-expires",
    label: "An invite link expires",
    description: "Speakers and organizers invited by email",
    audience: "platform",
    email: true,
    push: null,
  },
  {
    id: "event-cancelled",
    label: "An organizer cancels an event",
    description: "With the number of attendees affected",
    audience: "platform",
    email: false,
    push: null,
  },
  {
    id: "weekly-summary",
    label: "Weekly platform summary",
    description: "Mondays at 08:00",
    audience: "platform",
    email: false,
    push: null,
  },
];
