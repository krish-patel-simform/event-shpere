/** Day, month and clock time of an instant, as seen in a time zone. */
function zonedParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: get("day"),
    month: get("month"),
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * A booked slot in the venue's own zone: "12 Dec, 10:00–12:00" on one day, or
 * "12 Dec 22:00 – 13 Dec 02:00" across midnight. Built from parts, because Intl's own joiners
 * differ between browsers and Node versions.
 */
export function formatSlot(
  startAt: string,
  endAt: string,
  timeZone: string,
): string {
  const start = zonedParts(startAt, timeZone);
  const end = zonedParts(endAt, timeZone);
  const sameDay = start.day === end.day && start.month === end.month;

  return sameDay
    ? `${start.day} ${start.month}, ${start.time}–${end.time}`
    : `${start.day} ${start.month} ${start.time} – ${end.day} ${end.month} ${end.time}`;
}
