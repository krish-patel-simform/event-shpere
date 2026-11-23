// Dates and times in a given IANA time zone (an event's own zone), so every viewer reads the
// time the organizer set, and the server and the browser print the same text. Every format is
// built from parts, because Intl's own joiners differ between browsers and Node versions.

const ZONE_NAMES: Record<string, string> = { "Asia/Kolkata": "IST" };

/** "IST" for India; any other zone shows its IANA name. */
export function zoneLabel(timezone: string): string {
  return ZONE_NAMES[timezone] ?? timezone;
}

/** The parts of a moment as the clock shows it in `timeZone` ("Thu", "3", "Dec", "2026", "09", "30"). */
export function zonedParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "Tue 2 Dec 2026, 18:00": one moment, with its day and time. */
export function formatZonedDateTime(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/**
 * "3 – 5 Dec 2026", or "14 Nov 2026" for a single day. With `weekday`: "Wed 3 – Fri 5 Dec 2026".
 */
export function formatEventDates(
  startAt: string,
  endAt: string,
  timezone: string,
  { weekday = false }: { weekday?: boolean } = {},
): string {
  const start = zonedParts(startAt, timezone);
  const end = zonedParts(endAt, timezone);
  const day = (p: typeof start) => (weekday ? `${p.weekday} ${p.day}` : p.day);
  const full = (p: typeof start) => `${day(p)} ${p.month} ${p.year}`;

  if (full(start) === full(end)) return full(start);
  if (start.month === end.month && start.year === end.year) {
    return `${day(start)} – ${day(end)} ${end.month} ${end.year}`;
  }
  if (start.year === end.year) {
    return `${day(start)} ${start.month} – ${full(end)}`;
  }
  return `${full(start)} – ${full(end)}`;
}

/** "09:00 – 18:00 IST": the first day's start to the last day's end. */
export function formatEventTimes(
  startAt: string,
  endAt: string,
  timezone: string,
): string {
  const start = zonedParts(startAt, timezone);
  const end = zonedParts(endAt, timezone);
  return `${start.hour}:${start.minute} – ${end.hour}:${end.minute} ${zoneLabel(timezone)}`;
}

/** The little date block in front of a title: { day: "03", month: "DEC" }. */
export function thumbDate(
  startAt: string,
  timezone: string,
): { day: string; month: string } {
  const { day, month } = zonedParts(startAt, timezone);
  return { day: day.padStart(2, "0"), month: month.toUpperCase() };
}

/** "2026-12-03": the calendar day of a moment in `timeZone`, to compare days. */
export function zonedDayKey(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
