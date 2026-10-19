// The ONE place permission codes are defined (from docs/permissions.md). Routes use the
// PERMISSION constants below; the seed writes this list to the permissions table.
// To add or rename a code: change it here, fix what TypeScript flags, run `npm run db:seed`.
// No "server-only": the UI may use the codes too (e.g. to hide a button).

export const PERMISSIONS = [
  { code: "PROFILE_VIEW", description: "View own profile and account details" },
  { code: "PROFILE_MANAGE", description: "Edit own name, photo, interests, and password" },
  { code: "ORGANIZER_PROFILE_MANAGE_OWN", description: "Edit own organization name and website" },
  { code: "EVENT_CREATE", description: "Create a new event (saved as draft)" },
  { code: "EVENT_MANAGE_OWN", description: "Update, cancel, or delete events the user created" },
  { code: "EVENT_MANAGE_ALL", description: "Update, cancel, or delete any event" },
  { code: "EVENT_PUBLISH_OWN", description: "Publish or unpublish events the user created" },
  { code: "EVENT_PUBLISH_ALL", description: "Publish or unpublish any event" },
  { code: "REGISTRATION_CREATE", description: "Register for an event" },
  { code: "REGISTRATION_VIEW_OWN", description: "View own tickets and registrations" },
  { code: "REGISTRATION_VIEW_EVENT", description: "View the attendee list of events the user organizes" },
  { code: "REGISTRATION_VIEW_ALL", description: "View every registration on the platform" },
  { code: "REGISTRATION_MANAGE", description: "Update or cancel own registration" },
  { code: "REGISTRATION_CHECKIN_EVENT", description: "Check in attendees at events the user organizes" },
  { code: "REGISTRATION_CHECKIN_ALL", description: "Check in attendees at any event" },
  { code: "PAYMENT_CHECKOUT", description: "Pay for paid tickets through Stripe" },
  { code: "PAYMENT_VIEW_OWN", description: "View own payment history and receipts" },
  { code: "PAYMENT_VIEW_EVENT", description: "View payments and revenue of events the user organizes" },
  { code: "PAYMENT_VIEW_ALL", description: "View all payments and revenue on the platform" },
  { code: "PAYMENT_REFUND_EVENT", description: "Issue refunds for tickets of events the user organizes" },
  { code: "PAYMENT_REFUND_ALL", description: "Issue refunds for any ticket" },
  { code: "SPEAKER_CREATE", description: "Add or invite speakers to events (Organizer: events they organize; Admin: any event)" },
  { code: "SPEAKER_MANAGE_OWN", description: "Edit own speaker bio, photo, and social links" },
  { code: "SPEAKER_MANAGE_EVENT", description: "Edit or remove speakers in events the user organizes" },
  { code: "SPEAKER_MANAGE_ALL", description: "Edit or remove any speaker profile" },
  { code: "SESSION_CREATE", description: "Create sessions in events (Organizer: events they organize; Admin: any event)" },
  { code: "SESSION_MANAGE", description: "Edit, reschedule, or delete sessions (Organizer: events they organize; Admin: any event)" },
  { code: "SESSION_MATERIAL_UPLOAD_ASSIGNED", description: "Upload slides or resources for own sessions" },
  { code: "SESSION_MATERIAL_UPLOAD_EVENT", description: "Upload materials for sessions in events the user organizes" },
  { code: "SESSION_MATERIAL_UPLOAD_ALL", description: "Upload materials for any session" },
  { code: "SCHEDULE_MANAGE", description: "Add or remove sessions in own personal schedule" },
  { code: "SCHEDULE_EXPORT", description: "Export own personal schedule to a calendar" },
  { code: "POLL_VIEW", description: "View polls and live results" },
  { code: "POLL_VOTE", description: "Vote in a live poll" },
  { code: "POLL_CREATE_ASSIGNED", description: "Create polls for own sessions" },
  { code: "POLL_CREATE_EVENT", description: "Create polls for sessions in events the user organizes" },
  { code: "POLL_CREATE_ALL", description: "Create polls for any session" },
  { code: "POLL_MANAGE_ASSIGNED", description: "Open, close, reset, edit, or delete polls in own sessions" },
  { code: "POLL_MANAGE_EVENT", description: "Open, close, reset, edit, or delete polls in events the user organizes" },
  { code: "POLL_MANAGE_ALL", description: "Open, close, reset, edit, or delete any poll" },
  { code: "NOTIFICATION_VIEW", description: "Receive and read own notifications" },
  { code: "NOTIFICATION_MANAGE", description: "Update own notification preferences" },
  { code: "NOTIFICATION_SEND_EVENT", description: "Send announcements to attendees of events the user organizes" },
  { code: "NOTIFICATION_SEND_ALL", description: "Send platform-wide announcements to all users" },
  { code: "ANALYTICS_VIEW_EVENT", description: "View dashboards and charts for events the user organizes" },
  { code: "ANALYTICS_VIEW_ALL", description: "View platform-wide dashboards and charts" },
  { code: "USER_VIEW", description: "View all users on the platform" },
  { code: "USER_ROLE_MANAGE", description: "Change a user's role" },
  { code: "USER_STATUS_MANAGE", description: "Suspend or reactivate a user account" },
  { code: "ORGANIZER_CREATE", description: "Create an organizer account with its organizer profile and send the account-setup link" },
  { code: "ORGANIZER_VERIFY", description: "Verify or revoke the verification of an organizer" },
  { code: "ORGANIZER_MANAGE", description: "Edit any organizer's organization details" },
  { code: "MODERATION_MANAGE", description: "Remove inappropriate events, content, or poll entries" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** `PERMISSION.ORGANIZER_CREATE === "ORGANIZER_CREATE"`: use these instead of raw strings. */
export const PERMISSION = Object.fromEntries(
  PERMISSIONS.map((p) => [p.code, p.code]),
) as { readonly [K in PermissionCode]: K };
