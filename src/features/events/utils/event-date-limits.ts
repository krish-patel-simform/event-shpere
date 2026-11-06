import { addYearsToDateKey } from "@/src/core/format/date-key";
import { fromMinutes, toMinutes } from "@/src/core/format/time-key";
import { toFormDateTime } from "./event-display";

// What the event form lets a person pick. Events are in India for now, so "today" and "now" are
// India Standard Time, whatever zone the browser is in. The server has the final say; this keeps
// the pickers from offering what it would refuse.

const IST = "Asia/Kolkata";

/** An event can be planned this many years ahead. */
export const EVENT_YEARS_AHEAD = 10;

/** The times offered in the time picker are this many minutes apart. */
export const EVENT_TIME_STEP = 15;

const DAY_START = "00:00";

/** Today in IST, and the last day an event can be planned for. */
export function eventDateLimits(now: Date = new Date()): {
  min: string;
  max: string;
} {
  const today = toFormDateTime(now.toISOString(), IST).date;
  // The date is always a real one, so this is never null.
  return {
    min: today,
    max: addYearsToDateKey(today, EVENT_YEARS_AHEAD) ?? today,
  };
}

/**
 * The earliest start time on `startDate`, as "HH:mm": the next slot after now when the event
 * starts today (the server needs a start in the future), any time otherwise. Null when no slot is
 * left today.
 */
export function earliestStartTime(
  startDate: string,
  now: Date = new Date(),
): string | null {
  const { date, time } = toFormDateTime(now.toISOString(), IST);
  if (startDate !== date) return DAY_START;

  const minutes = toMinutes(time);
  if (minutes === null) return DAY_START;
  const next = (Math.floor(minutes / EVENT_TIME_STEP) + 1) * EVENT_TIME_STEP;
  return next < 24 * 60 ? fromMinutes(next) : null;
}

/**
 * The earliest end time, as "HH:mm": one minute after the start when the event ends on the day it
 * starts, any time otherwise. Null when nothing is left that day.
 */
export function earliestEndTime(
  startDate: string,
  startTime: string,
  endDate: string,
): string | null {
  if (!startDate || startDate !== endDate) return DAY_START;

  const start = toMinutes(startTime);
  if (start === null) return DAY_START;
  return start + 1 < 24 * 60 ? fromMinutes(start + 1) : null;
}
