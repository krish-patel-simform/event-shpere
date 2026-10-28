import type {
  NotificationTopic,
  ProfileDetails,
  UnavailableFeature,
} from "../types/profile";

// TODO(API): sample data for "Profile & settings" until its endpoints exist (GET /api/me,
// PATCH /api/me, POST /api/me/password, notification preferences). The one place these values
// live: replace them with the API data, not the components.
export const PROFILE_SAMPLE: ProfileDetails = {
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya.rao@example.com",
  emailVerified: true,
  role: "speaker",
};

/** What a form says after a valid submit, until the forms are sent to the server. */
export const SAMPLE_SAVED_NOTE =
  "Saved (sample data, not sent to the server yet)";

/** Topics for someone who reviews organizers (permission ORGANIZER_VERIFY). */
export const PLATFORM_NOTIFICATION_TOPICS: readonly NotificationTopic[] = [
  {
    id: "organizer-applies",
    label: "A new organizer applies",
    description: "One email per application",
  },
  {
    id: "applications-waiting",
    label: "Applications wait over 7 days",
    description: "A daily reminder",
  },
  {
    id: "invite-expires",
    label: "An invite link expires",
    description: "Speakers and organizers invited by email",
  },
  {
    id: "weekly-summary",
    label: "Weekly platform summary",
    description: "Every Monday morning",
  },
];

/** Topics for everyone else who gets event emails. */
export const EVENT_NOTIFICATION_TOPICS: readonly NotificationTopic[] = [
  {
    id: "session-reminders",
    label: "Session reminders",
    description: "Before a session in your agenda starts",
  },
  {
    id: "event-announcements",
    label: "Event announcements",
    description: "News from the organizers of events you registered for",
  },
  {
    id: "schedule-changes",
    label: "Schedule changes",
    description: "When a session you follow moves or is cancelled",
  },
];

/** Shown honestly as "not available yet": the design has them, the API does not. */
export const UNAVAILABLE_FEATURES: readonly UnavailableFeature[] = [
  {
    id: "profile-photo",
    label: "Profile photo upload",
    description: "Your initials are used instead for now.",
  },
  {
    id: "time-zone",
    label: "Time zone and date format",
    description: "Dates are shown in the format of your browser.",
  },
  {
    id: "two-step",
    label: "Two-step verification",
    description: "An extra one-time code when you sign in on a new device.",
  },
  {
    id: "devices",
    label: "Where you are signed in",
    description: "A list of your devices, with a way to sign out of each one.",
  },
  {
    id: "delete-account",
    label: "Delete account",
    description: "Ask for your account and personal data to be removed.",
  },
];
