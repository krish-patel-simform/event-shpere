import type { SampleAttendee } from "../sample/organizer-sample";

export type AttendeeStatusFilter = "all" | SampleAttendee["status"];

export const ATTENDEE_STATUS_META: Record<
  SampleAttendee["status"],
  { label: string; tone: "success" | "danger" }
> = {
  registered: { label: "Registered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export type AttendeeFilters = {
  search: string;
  /** A session id: only the people who booked it; null = every registration. */
  sessionId: string | null;
  status: AttendeeStatusFilter;
};

export const DEFAULT_ATTENDEE_FILTERS: AttendeeFilters = {
  search: "",
  sessionId: null,
  status: "all",
};

/** Whether any filter is set, so an empty list can say "no match" instead of "no attendees". */
export function isFilteringAttendees(filters: AttendeeFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.sessionId !== null ||
    filters.status !== "all"
  );
}

/** The attendees whose name or email contains the search, who booked the session, and have the status. */
export function filterAttendees(
  attendees: readonly SampleAttendee[],
  { search, sessionId, status }: AttendeeFilters,
): SampleAttendee[] {
  const needle = search.trim().toLowerCase();
  return attendees.filter(
    (attendee) =>
      (needle === "" ||
        attendee.name.toLowerCase().includes(needle) ||
        attendee.email.toLowerCase().includes(needle)) &&
      (sessionId === null || attendee.sessionIds.includes(sessionId)) &&
      (status === "all" || attendee.status === status),
  );
}

/** The word for the `status` select value; anything else is "all". */
export function parseStatusFilter(value: string): AttendeeStatusFilter {
  return value === "registered" || value === "cancelled" ? value : "all";
}

/** "3 of 6" style average, one decimal: 1286 bookings over 480 attendees → "2.7". */
export function averageBookings(bookings: number, attendees: number): string {
  if (attendees === 0) return "0";
  return (bookings / attendees).toFixed(1);
}
