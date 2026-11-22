import { zonedDayKey } from "../../../core/format/format-zoned";

// Event days and their check-in windows. An event stores one start and one end, and every day runs
// on the SAME hours: from day 1's start time to the end's clock time (09:30 → 18:00 every day). An
// end clock time at or before the start one runs past midnight (22:00 → 02:00 next morning), so an
// overnight event is ONE day, not two. Days are counted in whole 24-hour steps, which is exact for
// zones without daylight saving (India); in a zone with it, a day after the change would be an
// hour off.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** What the rules need to know about the event. */
export type AttendanceEvent = {
  startAt: Date | string;
  endAt: Date | string;
  /** IANA zone: the days are the event's own calendar days. */
  timezone: string;
};

const startMs = (event: AttendanceEvent) => new Date(event.startAt).getTime();
const totalMs = (event: AttendanceEvent) =>
  new Date(event.endAt).getTime() - startMs(event);

/**
 * How long each day runs: 09:30 → 18:00 is 8 h 30; 22:00 → 02:00 is 4 h. A run of exactly 24 h
 * (09:00 → 09:00 the next day) is one full day, not zero.
 */
export function dailyRunMs(event: AttendanceEvent): number {
  const total = totalMs(event);
  if (total <= 0) return 0;
  const rest = total % DAY_MS;
  return rest === 0 ? DAY_MS : rest;
}

/** How many days the event runs: one per daily start, the last one ending at the event's end. */
function dayCount(event: AttendanceEvent): number {
  const total = totalMs(event);
  if (total <= 0) return 1;
  return Math.floor((total - dailyRunMs(event)) / DAY_MS) + 1;
}

/** When the event's day number `index` (0 = day 1) starts. */
function dayStart(event: AttendanceEvent, index: number): number {
  return startMs(event) + index * DAY_MS;
}

/**
 * Every day of the event, "2026-12-03": the calendar date (in the event's zone) each day STARTS
 * on, first to last. 22:00 → 02:00 is one day, keyed by the date it starts.
 */
export function eventDayKeys(event: AttendanceEvent): string[] {
  return Array.from({ length: dayCount(event) }, (_, index) =>
    zonedDayKey(new Date(dayStart(event, index)), event.timezone),
  );
}

/**
 * The check-in window of one event day (`date` = "2026-12-04"), or null when the date is not a
 * day of the event. It opens `opensHoursBefore` before that day's start (6 in production, a year
 * in dev) and stays open until THAT day's hours end (the last day's end is the event's end). So a
 * late arrival can check in while the day is still running, and a past day is always refused.
 * When the next day's door opens before this one closes, both are open for that overlap.
 */
export function dayCheckInWindow(
  date: string,
  event: AttendanceEvent,
  opensHoursBefore: number,
): { opensAt: Date; closesAt: Date } | null {
  const index = eventDayKeys(event).indexOf(date);
  if (index === -1) return null;

  const start = dayStart(event, index);
  return {
    opensAt: new Date(start - opensHoursBefore * HOUR_MS),
    closesAt: new Date(start + dailyRunMs(event)),
  };
}

/**
 * The event day a moment belongs to: the first day whose hours have not ended yet (so a moment
 * between two days belongs to the next one, and a moment before day 1 is day 1); after the event,
 * the last day. Used for a SESSION: it belongs to the event day its start falls in, the day the
 * person came through the event door for.
 */
export function eventDayOf(moment: Date, event: AttendanceEvent): string {
  const keys = eventDayKeys(event);
  const run = dailyRunMs(event);
  const index = keys.findIndex(
    (_, day) => moment.getTime() < dayStart(event, day) + run,
  );
  return keys[index === -1 ? keys.length - 1 : index]!;
}
