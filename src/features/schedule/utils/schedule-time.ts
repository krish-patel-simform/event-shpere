// Date and time text for the schedule. Always UTC and en-GB, so the server and the browser print
// the same text (a local time zone would differ and break hydration). The parts are joined here
// because Intl's own joiner varies by ICU version ("Thu 4 Dec" vs "Thu, 4 Dec").

function parts(iso: string, options: Intl.DateTimeFormatOptions) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "UTC",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((part) => part.type === type)?.value ?? "";
  return get;
}

/** "10:30" (24 hour). */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** "2026-12-04": the UTC day, used to group items and as the key of a day tab. */
export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** "Thu, 4 Dec" */
export function formatDayLabel(iso: string): string {
  const get = parts(iso, { weekday: "short", day: "numeric", month: "short" });
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** "Thursday, 4 December 2026" */
export function formatDayHeading(iso: string): string {
  const get = parts(iso, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}

/** Minutes between two ISO times (0 when the end is not after the start). */
export function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000,
    ),
  );
}
