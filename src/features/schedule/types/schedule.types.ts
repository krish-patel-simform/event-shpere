// Shapes of the "My schedule" screen. UI only for now: there is no agenda API yet, so these are
// plain types for the sample data, not DTOs from a Zod schema.

export type ScheduleItem = {
  id: string;
  title: string;
  /** ISO, UTC. */
  startsAt: string;
  /** ISO, UTC. */
  endsAt: string;
  /** A room or place; null when there is none to show. */
  location: string | null;
  /** "Talk", "Workshop"... */
  format: string | null;
  /** Names of the people speaking. */
  speakers: string[];
  /** A `session` can be added to the schedule; a `break` (coffee, lunch) cannot. */
  kind: "session" | "break";
  /** In the signed-in person's own schedule. */
  inSchedule: boolean;
  /** The signed-in person speaks in this session. */
  speaking: boolean;
};

export type ScheduleView = "mine" | "full";

export type ScheduleDay = {
  /** "2026-12-04" (UTC): the key of the day tab. */
  key: string;
  /** "Thu, 4 Dec" */
  label: string;
  /** "Thursday, 4 December 2026" */
  heading: string;
  /** Sorted by start time. */
  items: ScheduleItem[];
};
