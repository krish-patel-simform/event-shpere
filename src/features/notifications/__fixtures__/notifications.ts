import type { NotificationDto } from "../schemas/notification.schema";

// Notifications for tests. Not used by the app. Written against NOW so grouping is stable.
export const NOW = "2026-10-27T12:00:00Z";

/** Personal, unread, today (2 hours ago). Category: sessions. */
export const sessionConfirmed: NotificationDto = {
  id: "7c2e4d31-8b5f-4e2c-9d4b-2f3a4b5c6d01",
  type: "session_confirmed",
  title: "Your session was confirmed.",
  body: "It is scheduled for Fri, 5 Dec.",
  createdAt: "2026-10-27T10:00:00Z",
  readAt: null,
};

/** Platform-wide, unread, today (2 hours ago). Category: approvals. */
export const organizerApplication: NotificationDto = {
  id: "7c2e4d31-8b5f-4e2c-9d4b-2f3a4b5c6d02",
  type: "organizer_application",
  title: "New organizer application.",
  body: "Acme Events applied.",
  createdAt: "2026-10-27T09:30:00Z",
  readAt: null,
  action: { label: "Review application", href: "/admin/organizers" },
};

/** Personal, read, yesterday. Category: sessions. */
export const coSpeakerAccepted: NotificationDto = {
  id: "7c2e4d31-8b5f-4e2c-9d4b-2f3a4b5c6d03",
  type: "co_speaker_accepted",
  title: "Vikram Mehta",
  body: "accepted your co-speaker invitation.",
  createdAt: "2026-10-26T16:20:00Z",
  readAt: "2026-10-26T18:00:00Z",
};

/** Platform-wide, read, 5 days ago (this week). Category: users. */
export const userSuspended: NotificationDto = {
  id: "7c2e4d31-8b5f-4e2c-9d4b-2f3a4b5c6d04",
  type: "user_suspended",
  title: "Dev Verma was suspended",
  body: "by you.",
  createdAt: "2026-10-22T14:30:00Z",
  readAt: "2026-10-22T15:00:00Z",
};

/** Personal, read, 13 days ago (earlier). Category: system. */
export const securitySignIn: NotificationDto = {
  id: "7c2e4d31-8b5f-4e2c-9d4b-2f3a4b5c6d05",
  type: "security_sign_in",
  title: "New sign-in to your account.",
  body: "If this was not you, change your password.",
  createdAt: "2026-10-14T09:12:00Z",
  readAt: "2026-10-14T09:30:00Z",
};

/** Deliberately not in date order, to prove the list sorts. */
export const allNotifications: NotificationDto[] = [
  coSpeakerAccepted,
  securitySignIn,
  sessionConfirmed,
  userSuspended,
  organizerApplication,
];

/** What a person without platform rights is sent: personal ones only. */
export const personalNotifications: NotificationDto[] = [
  sessionConfirmed,
  coSpeakerAccepted,
  securitySignIn,
];
