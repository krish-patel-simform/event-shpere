import type {
  AttendeeDto,
  SessionAttendeeDto,
} from "../schemas/attendees.schemas";
import { eventDayKeys } from "./attendance-day";

/** One day of an event, for the "Event day" picker: "2026-12-03" and "Thu 3 Dec". */
export type EventDay = { key: string; label: string };

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  // The key is already the event's own calendar day: read it as a plain date.
  timeZone: "UTC",
});

/**
 * Every day of the event (the days route 5's `date` and the check-in door take), keyed by the
 * date it starts on in the event's zone. Days follow the event's daily hours, so an overnight
 * event (22:00 → 02:00) is one day, not two. A one-day event has one; the picker is only shown
 * for more.
 */
export function eventDays(
  startAt: string,
  endAt: string,
  timezone: string,
): EventDay[] {
  return eventDayKeys({ startAt, endAt, timezone }).map((key) => ({
    key,
    label: DAY_LABEL.format(new Date(`${key}T00:00:00.000Z`)),
  }));
}

/** The filters that hide rows (the day and the sort only change what the rows say). */
export type AttendeeRowFilters = {
  search: string;
  status: "all" | "registered" | "cancelled";
  checkedIn: "all" | "yes" | "no";
};

export function isFilteringAttendees(filters: AttendeeRowFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.checkedIn !== "all"
  );
}

/**
 * The row's status badge. A registered person who checked in shows "Checked in", so the two can
 * be told apart at a glance; with an event day picked, it means checked in on that day (the row's
 * `checkedInAt` is that day's).
 */
export function attendeeStatus(attendee: AttendeeDto): {
  label: "Checked in" | "Registered" | "Cancelled";
  tone: "success" | "brand" | "danger";
} {
  if (attendee.status === "cancelled") {
    return { label: "Cancelled", tone: "danger" };
  }
  return attendee.checkedInAt
    ? { label: "Checked in", tone: "success" }
    : { label: "Registered", tone: "brand" };
}

/**
 * A seat's status badge in a session's list: "Checked in" (green) once the seat was used at the
 * session door, else "Registered" (blue), or "Cancelled" (red).
 */
export function sessionSeatStatus(
  seat: Pick<SessionAttendeeDto, "status" | "checkedInAt">,
): ReturnType<typeof attendeeStatus> {
  if (seat.status === "cancelled")
    return { label: "Cancelled", tone: "danger" };
  return seat.checkedInAt
    ? { label: "Checked in", tone: "success" }
    : { label: "Registered", tone: "brand" };
}

/** "2.7": session seats per registered person, one decimal; "0" when nobody is registered. */
export function averageBookings(bookings: number, registered: number): string {
  if (registered === 0) return "0";
  return (bookings / registered).toFixed(1);
}

/** "44%": the share of registered people who checked in; 0% when nobody is registered. */
export function checkedInPercent(
  checkedIn: number,
  registered: number,
): string {
  if (registered === 0) return "0%";
  return `${Math.round((checkedIn / registered) * 100)}%`;
}

const METHOD_LABELS: Record<
  NonNullable<AttendeeDto["checkInMethod"]>,
  string
> = {
  manual: "manual",
  qr_scan: "QR scan",
};

/** "by Omkar Patil · manual", "by Omkar Patil", "QR scan" or null: who checked them in, and how. */
export function checkedInByLine(attendee: AttendeeDto): string | null {
  const by = attendee.checkedInBy
    ? `by ${attendee.checkedInBy.firstName} ${attendee.checkedInBy.lastName}`
    : null;
  const how = attendee.checkInMethod
    ? METHOD_LABELS[attendee.checkInMethod]
    : null;
  const parts = [by, how].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
