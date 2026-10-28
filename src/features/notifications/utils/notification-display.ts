import { formatDate } from "@/src/core/format/format-date";
import type { NotificationDto } from "../schemas/notification.schema";
import type { NotificationGroupKey } from "../types/notification";

// Display helpers. Nothing here reads the clock: `now` is always passed in, so the grouping and
// the "2 hours ago" text are the same on the server, in the browser and in tests.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const GROUP_ORDER: readonly NotificationGroupKey[] = [
  "today",
  "yesterday",
  "this-week",
  "earlier",
];

export const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "Earlier this week",
  earlier: "Earlier",
};

/** Midnight (UTC) of the day `iso` falls on, in ms. Days are UTC, like formatDate. */
function utcDayStart(iso: string): number {
  const date = new Date(iso);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole calendar days between `iso` and `now`; never below 0 (a time in the future is today). */
function daysAgo(iso: string, now: string): number {
  return Math.max(0, Math.round((utcDayStart(now) - utcDayStart(iso)) / DAY));
}

export function groupKeyOf(iso: string, now: string): NotificationGroupKey {
  const days = daysAgo(iso, now);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return "this-week";
  return "earlier";
}

/** "10:02", in UTC. */
function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * "Just now", "2 hours ago" (today), "Yesterday at 16:20", then "14 Oct 2026 at 09:12". The same
 * text is used for the visible time and, with the ISO value, for <time dateTime>.
 */
export function formatNotificationTime(iso: string, now: string): string {
  const days = daysAgo(iso, now);
  if (days === 0) {
    const elapsed = new Date(now).getTime() - new Date(iso).getTime();
    if (elapsed < MINUTE) return "Just now";
    if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), "minute");
    return plural(Math.floor(elapsed / HOUR), "hour");
  }
  if (days === 1) return `Yesterday at ${formatTime(iso)}`;
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

export type NotificationGroup = {
  key: NotificationGroupKey;
  label: string;
  items: NotificationDto[];
};

/** Newest first, split into day sections. A section with nothing in it is left out. */
export function groupByDay(
  list: readonly NotificationDto[],
  now: string,
): NotificationGroup[] {
  const sorted = [...list].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  return GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: sorted.filter((item) => groupKeyOf(item.createdAt, now) === key),
  })).filter((group) => group.items.length > 0);
}
