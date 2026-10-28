/** "10:02" (24 hour, UTC: the same on the server and in the browser, so it cannot break hydration). */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "4 min ago", "2 h ago", "3 d ago". A time after `now` counts as "just now". */
export function timeAgo(iso: string, now: string): string {
  const elapsed = Math.max(
    0,
    new Date(now).getTime() - new Date(iso).getTime(),
  );
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}

/** "14 min" or "1 h 05 min": how long a poll has been open. */
export function formatOpenFor(openedAt: string, now: string): string {
  const minutes = Math.floor(
    Math.max(0, new Date(now).getTime() - new Date(openedAt).getTime()) /
      MINUTE,
  );
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
