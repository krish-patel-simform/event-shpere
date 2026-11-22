import { eventDays } from "./attendee-display";
import { dayCheckInWindow, type AttendanceEvent } from "./attendance-day";

// Is the door open, and for which day? The SAME rule as the server (dayCheckInWindow, with the
// setting the server sends in the list's meta), so the screen greys out what the server would
// refuse. The server still decides: if the clocks differ, its 409 is what the result row shows.

/** The event's status as the organizer's pages see it ("completed" = published and over). */
export type DoorEventStatus = "draft" | "published" | "completed" | "cancelled";

/** One event day at the event door. */
export type DoorDay = {
  /** "2026-12-04", in the event's zone: what route 6 gets as `attendanceDate`. */
  key: string;
  /** "Fri 4 Dec" */
  label: string;
  /** "Day 2 of 3" (null on a one-day event, where it says nothing). */
  dayOfLabel: string | null;
  opensAt: Date;
  closesAt: Date;
  state: "open" | "not-open" | "closed";
};

/** Every day of the event with its window and whether it is open at `now`. */
export function doorDays(
  event: AttendanceEvent,
  opensHoursBefore: number,
  now: Date,
): DoorDay[] {
  const days = eventDays(
    new Date(event.startAt).toISOString(),
    new Date(event.endAt).toISOString(),
    event.timezone,
  );
  return days.flatMap((day, index) => {
    const window = dayCheckInWindow(day.key, event, opensHoursBefore);
    if (!window) return [];
    return [
      {
        key: day.key,
        label: day.label,
        dayOfLabel:
          days.length > 1 ? `Day ${index + 1} of ${days.length}` : null,
        ...window,
        state:
          now < window.opensAt
            ? "not-open"
            : now >= window.closesAt
              ? "closed"
              : "open",
      },
    ];
  });
}

/** What the event door shows: a reason it is shut, or the day it checks people in for. */
export type EventDoor =
  | { kind: "draft" }
  | { kind: "cancelled" }
  | { kind: "closed" }
  | { kind: "not-open"; opensAt: Date }
  | { kind: "open"; day: DoorDay };

/**
 * The event door. A draft or a cancelled event never opens; a finished event (or one whose days
 * have all closed) is closed. Otherwise the door checks in for the day the staff picked if that
 * day is open, else the first open day (in production only one day is open at a time; in dev, with
 * its year-long window, every day that has not closed is, and the first of them is the default).
 * No open day yet: it says when the next one opens.
 */
export function eventDoor(
  status: DoorEventStatus,
  days: readonly DoorDay[],
  pickedKey: string | null,
): EventDoor {
  if (status === "draft") return { kind: "draft" };
  if (status === "cancelled") return { kind: "cancelled" };
  if (status === "completed") return { kind: "closed" };

  const picked = days.find(
    (day) => day.key === pickedKey && day.state === "open",
  );
  const open = picked ?? days.find((day) => day.state === "open");
  if (open) return { kind: "open", day: open };

  const next = days.find((day) => day.state === "not-open");
  return next
    ? { kind: "not-open", opensAt: next.opensAt }
    : { kind: "closed" };
}

/** What the session door shows. */
export type SessionDoor =
  | { kind: "event-draft" }
  | { kind: "event-cancelled" }
  | { kind: "cancelled" }
  | { kind: "unscheduled" }
  | { kind: "closed" }
  | { kind: "not-open"; opensAt: Date }
  | { kind: "open" };

/**
 * A session's door, in the server's order: the event must be published, the session scheduled
 * (with a time), and now must be from `opensHoursBefore` before it starts until it ends.
 */
export function sessionDoor(
  session: {
    eventStatus: DoorEventStatus;
    status: "draft" | "scheduled" | "cancelled";
    startAt: string | null;
    endAt: string | null;
  },
  opensHoursBefore: number,
  now: Date,
): SessionDoor {
  if (session.eventStatus === "draft") return { kind: "event-draft" };
  if (session.eventStatus === "cancelled") return { kind: "event-cancelled" };
  if (session.status === "cancelled") return { kind: "cancelled" };
  if (session.status === "draft" || !session.startAt || !session.endAt) {
    return { kind: "unscheduled" };
  }
  if (now >= new Date(session.endAt)) return { kind: "closed" };
  const opensAt = new Date(
    new Date(session.startAt).getTime() - opensHoursBefore * 60 * 60 * 1000,
  );
  if (now < opensAt) return { kind: "not-open", opensAt };
  return { kind: "open" };
}
