import type { OrganizerEventCounts } from "../types/admin-organizers";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An application waiting longer than this many days is shown in red. */
export const OVERDUE_AFTER_DAYS = 8;

/** Whole days between the application and `asOf` (never negative). */
export function daysWaiting(appliedAt: string, asOf: string): number {
  const elapsed = new Date(asOf).getTime() - new Date(appliedAt).getTime();
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/** 0 → "Applied today", 1 → "1 day waiting", 14 → "14 days waiting". */
export function waitingLabel(days: number): string {
  if (days === 0) return "Applied today";
  return `${days} ${days === 1 ? "day" : "days"} waiting`;
}

/** { published: 4, drafts: 1 } → "4 published · 1 draft". Nothing at all → "No events yet". */
export function formatEventCounts(events: OrganizerEventCounts): string {
  const parts = [
    events.published > 0 ? `${events.published} published` : null,
    events.drafts > 0
      ? `${events.drafts} ${events.drafts === 1 ? "draft" : "drafts"}`
      : null,
    events.completed > 0 ? `${events.completed} completed` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "No events yet";
}
