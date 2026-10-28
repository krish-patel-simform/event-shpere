// Shapes the three role home screens (attendee, speaker, organizer) have in common. No events,
// sessions or registrations API exists yet: the screens render sample data in these shapes.

/** One line in the "Notifications" / "Recent updates" card. */
export type HomeNotification = {
  id: string;
  /** Bold lead-in, e.g. "Session updated:". */
  lead?: string;
  message: string;
  /** ISO date-time; shown as a relative time ("1 hour ago"). */
  createdAt: string;
  read: boolean;
};
