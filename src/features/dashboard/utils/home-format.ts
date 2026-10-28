import { formatCount } from "@/src/core/format/format-number";

// Text helpers for the role home screens. Always one fixed time zone and English month names, so
// the server and the browser print the same text (a local zone would break hydration) and the
// tests do not depend on the machine.

// TODO(API): events will carry their own time zone; until then every event is in India.
const EVENT_TIME_ZONE = "Asia/Kolkata";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAYS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type DateParts = {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
};

function dateParts(iso: string): DateParts {
  const values: Record<string, number> = {};
  for (const part of PARTS_FORMAT.formatToParts(new Date(iso))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const { year, month, day, hour, minute } = values;
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "DEC" for a date tile. */
export function formatMonthTile(iso: string): string {
  return MONTHS_SHORT[dateParts(iso).month - 1].toUpperCase();
}

/** "3" for a date tile. */
export function formatDayTile(iso: string): string {
  return String(dateParts(iso).day);
}

/** "14 Nov". */
export function formatDayMonth(iso: string): string {
  const { day, month } = dateParts(iso);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** "Thu 4 Dec". */
export function formatWeekdayDayMonth(iso: string): string {
  const { day, month, weekday } = dateParts(iso);
  return `${WEEKDAYS_SHORT[weekday]} ${day} ${MONTHS_SHORT[month - 1]}`;
}

/** "Tuesday, 20 October 2026". */
export function formatFullDate(iso: string): string {
  const { day, month, year, weekday } = dateParts(iso);
  return `${WEEKDAYS_LONG[weekday]}, ${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

/** "10:00". */
export function formatTime(iso: string): string {
  const { hour, minute } = dateParts(iso);
  return `${pad(hour)}:${pad(minute)}`;
}

/** "10:00 – 10:45". */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** "14 Nov", "3–5 Dec" or "28 Nov – 2 Dec". */
export function formatDateRange(startsAt: string, endsAt: string): string {
  const start = dateParts(startsAt);
  const end = dateParts(endsAt);
  if (start.year === end.year && start.month === end.month) {
    if (start.day === end.day) return formatDayMonth(startsAt);
    return `${start.day}–${end.day} ${MONTHS_SHORT[end.month - 1]}`;
  }
  return `${formatDayMonth(startsAt)} – ${formatDayMonth(endsAt)}`;
}

/** "Thu 4 Dec", "Wed 3 – Fri 5 Dec" or "Sat 28 Nov – Tue 1 Dec". */
export function formatWeekdayRange(startsAt: string, endsAt: string): string {
  const start = dateParts(startsAt);
  const end = dateParts(endsAt);
  if (start.year === end.year && start.month === end.month) {
    if (start.day === end.day) return formatWeekdayDayMonth(startsAt);
    return `${WEEKDAYS_SHORT[start.weekday]} ${start.day} – ${formatWeekdayDayMonth(endsAt)}`;
  }
  return `${formatWeekdayDayMonth(startsAt)} – ${formatWeekdayDayMonth(endsAt)}`;
}

/** "Free" or "₹1,500". */
export function formatPrice(priceInr: number): string {
  return priceInr === 0 ? "Free" : `₹${formatCount(priceInr)}`;
}

/** "1 hour", "2 hours". */
export function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "1 hour ago", "2 days ago"; older than a week: the date. */
export function formatRelativeTime(iso: string, now: string): string {
  const elapsed = new Date(now).getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR)
    return `${plural(Math.floor(elapsed / MINUTE), "minute")} ago`;
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), "hour")} ago`;
  if (elapsed < 7 * DAY)
    return `${plural(Math.floor(elapsed / DAY), "day")} ago`;
  return formatDayMonth(iso);
}

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  /** True when `startsAt` is not after `now`: the timer is not shown. */
  started: boolean;
};

/** Whole days, hours and minutes from `now` until `startsAt`. */
export function getCountdown(startsAt: string, now: string): Countdown {
  const remaining = new Date(startsAt).getTime() - new Date(now).getTime();
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, started: true };
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    started: false,
  };
}

/** Calendar days from `now`'s date to `iso`'s date (negative when `iso` is in the past). */
function calendarDaysUntil(iso: string, now: string): number {
  const target = dateParts(iso);
  const today = dateParts(now);
  return Math.round(
    (Date.UTC(target.year, target.month - 1, target.day) -
      Date.UTC(today.year, today.month - 1, today.day)) /
      DAY,
  );
}

/** "Due 15 Nov · 26 days left", "Due today" or "Due 2 Nov · overdue". */
export function formatDue(dueAt: string, now: string): string {
  const days = calendarDaysUntil(dueAt, now);
  const date = `Due ${formatDayMonth(dueAt)}`;
  if (days === 0) return "Due today";
  if (days < 0) return `${date} · overdue`;
  return `${date} · ${plural(days, "day")} left`;
}

/** True when the due date is today or earlier. */
export function isDue(dueAt: string, now: string): boolean {
  return calendarDaysUntil(dueAt, now) <= 0;
}

/** Share of `value` in `total` in percent, 0 to 100; 0 when there is nothing to divide. */
export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
