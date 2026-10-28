import type { ComponentProps } from "react";
import { formatDate } from "@/src/core/format/format-date";
import type { Badge, Tab } from "@/src/core/ui";
import {
  SESSION_FORMAT_LABELS,
  SESSION_LEVEL_LABELS,
  SESSION_TRACK_LABELS,
} from "../constants";
import type {
  RegistrationDay,
  SessionItem,
  SessionStatus,
} from "../types/session";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

//* Labels

const STATUS_BADGES: Record<SessionStatus, { label: string; tone: BadgeTone }> =
  {
    confirmed: { label: "Confirmed", tone: "success" },
    under_review: { label: "Under review", tone: "warning" },
    draft: { label: "Draft", tone: "neutral" },
    completed: { label: "Completed", tone: "brand" },
  };

/** The status badge. The label is always shown, so colour is never the only signal. */
export function sessionStatusBadge(status: SessionStatus) {
  return STATUS_BADGES[status];
}

export const formatLabel = (session: Pick<SessionItem, "format">) =>
  SESSION_FORMAT_LABELS[session.format];
export const trackLabel = (session: Pick<SessionItem, "track">) =>
  SESSION_TRACK_LABELS[session.track];
export const levelLabel = (session: Pick<SessionItem, "level">) =>
  SESSION_LEVEL_LABELS[session.level];

/** "Talk · 45 min" */
export function formatAndDuration(
  session: Pick<SessionItem, "format" | "durationMinutes">,
): string {
  return `${formatLabel(session)} · ${session.durationMinutes} min`;
}

/**
 * The grey line under a title in the list: "Talk · 45 min · Frontend Architecture", plus what
 * matters for the status (when a draft was last edited, the rating of a finished session).
 */
export function sessionSubline(session: SessionItem): string {
  const parts = [formatAndDuration(session)];
  if (session.status === "draft") {
    parts.push(`Last edited ${formatDate(session.updatedAt)}`);
  } else if (session.rating !== null) {
    parts.push(`Rated ${session.rating.toFixed(1)} / 5`);
  } else {
    parts.push(trackLabel(session));
  }
  return parts.join(" · ");
}

//* Dates (UTC, like formatDate, so the server and the browser print the same text)

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** "Thu, 4 Dec" */
export function formatDayShort(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`;
}

/** "4 Dec" */
export function formatDayMonth(iso: string): string {
  return DAY_MONTH.format(new Date(iso));
}

/** "Thu, 4 Dec 2026" */
export function formatDayFull(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAY.format(date)}, ${formatDate(iso)}`;
}

/** "10:00 – 10:45" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${CLOCK.format(new Date(startsAt))} – ${CLOCK.format(new Date(endsAt))}`;
}

/** Whole days from `now` to `iso`, rounded up; never below 0. */
export function daysUntil(iso: string, now: string): number {
  const ms = new Date(iso).getTime() - new Date(now).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** "1.8 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

//* Registrations

/** Seats taken, as a whole percentage (0-100). */
export function fillPercent(registered: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((registered / capacity) * 100));
}

/** From this share of the seats on, the bar turns to the warning colour and the text says so. */
export const ALMOST_FULL_PERCENT = 90;

/** Heights (0-100) of the daily bars, relative to the busiest day. */
export function trendBarHeights(days: readonly RegistrationDay[]): number[] {
  const max = Math.max(0, ...days.map((day) => day.count));
  return days.map((day) =>
    max === 0 ? 0 : Math.round((day.count / max) * 100),
  );
}

//* Upcoming / past, tabs, filters and sorting

/** A finished session: marked completed, or its end time is before `now`. */
export function isPast(session: SessionItem, now: string): boolean {
  if (session.status === "completed") return true;
  return session.endsAt !== null && session.endsAt < now;
}

export type SessionTabKey =
  "all" | "confirmed" | "under_review" | "draft" | "past";

export const SESSION_TABS: readonly Tab<SessionTabKey>[] = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "under_review", label: "Under review" },
  { key: "draft", label: "Drafts" },
  { key: "past", label: "Past" },
];

/** Which tab a session belongs to. A finished session is only in "Past" (and "All"). */
export function inTab(
  session: SessionItem,
  tab: SessionTabKey,
  now: string,
): boolean {
  switch (tab) {
    case "all":
      return true;
    case "past":
      return isPast(session, now);
    case "confirmed":
      return session.status === "confirmed" && !isPast(session, now);
    case "under_review":
      return session.status === "under_review";
    case "draft":
      return session.status === "draft";
  }
}

export function countByTab(
  sessions: readonly SessionItem[],
  now: string,
): Record<SessionTabKey, number> {
  const counts: Record<SessionTabKey, number> = {
    all: 0,
    confirmed: 0,
    under_review: 0,
    draft: 0,
    past: 0,
  };
  for (const tab of SESSION_TABS) {
    counts[tab.key] = sessions.filter((session) =>
      inTab(session, tab.key, now),
    ).length;
  }
  return counts;
}

export type SessionSort = "date" | "registrations";

export type SessionFilters = {
  tab: SessionTabKey;
  /** Matches the title or the track, ignoring case. */
  search: string;
  /** An event name, or "all". */
  event: string;
  /** A format, or "all". */
  format: string;
  sort: SessionSort;
};

export const DEFAULT_SESSION_FILTERS: SessionFilters = {
  tab: "all",
  search: "",
  event: "all",
  format: "all",
  sort: "date",
};

/** True when anything narrows the list (an empty result then means "no match"). */
export function isFiltering(filters: SessionFilters): boolean {
  return (
    filters.tab !== "all" ||
    filters.search.trim() !== "" ||
    filters.event !== "all" ||
    filters.format !== "all"
  );
}

/** The event names in the data, for the Event select. */
export function eventNames(sessions: readonly SessionItem[]): string[] {
  return [...new Set(sessions.map((session) => session.eventName))].sort();
}

function matchesSearch(session: SessionItem, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term === "") return true;
  return (
    session.title.toLowerCase().includes(term) ||
    trackLabel(session).toLowerCase().includes(term)
  );
}

/** Where a session sits in the "soonest first" order: upcoming, then not scheduled, then past. */
function dateGroup(session: SessionItem, now: string): 0 | 1 | 2 {
  if (isPast(session, now)) return 2;
  return session.startsAt === null ? 1 : 0;
}

function bySoonest(now: string) {
  return (a: SessionItem, b: SessionItem): number => {
    const groupA = dateGroup(a, now);
    const groupB = dateGroup(b, now);
    if (groupA !== groupB) return groupA - groupB;
    if (groupA === 0) return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
    // Past: the most recent first. Not scheduled: the most recently edited first.
    if (groupA === 2) return (b.startsAt ?? "").localeCompare(a.startsAt ?? "");
    return b.updatedAt.localeCompare(a.updatedAt);
  };
}

const interest = (session: SessionItem) =>
  session.registrations?.registered ?? session.attended ?? -1;

/** Applies the tab, search, event and format filters, then the sort. Never changes `sessions`. */
export function applySessionFilters(
  sessions: readonly SessionItem[],
  filters: SessionFilters,
  now: string,
): SessionItem[] {
  const matches = sessions.filter(
    (session) =>
      inTab(session, filters.tab, now) &&
      matchesSearch(session, filters.search) &&
      (filters.event === "all" || session.eventName === filters.event) &&
      (filters.format === "all" || session.format === filters.format),
  );
  return matches.sort(
    filters.sort === "registrations"
      ? (a, b) => interest(b) - interest(a) || a.title.localeCompare(b.title)
      : bySoonest(now),
  );
}
