import type { SampleSession, SampleSpeaker } from "../sample/organizer-sample";
import { toFormDateTime } from "./event-display";

//* The board's frame

/** The board shows 09:00 to 18:00: one row per hour. */
export const BOARD_FIRST_HOUR = 9;
export const BOARD_LAST_HOUR = 18;
/** Height of one hour on the board, in px. */
export const HOUR_PX = 64;

const DAY_MS = 86_400_000;
/** A guard for a badly dated event: more than this many days are not drawn. */
const MAX_DAYS = 14;

export type BoardDay = {
  /** 0 = the event's first day. */
  index: number;
  /** The day in the event's zone: "2026-12-03". */
  key: string;
  /** "Thu 3 Dec". */
  label: string;
};

/** "Thu 3 Dec", in the event's zone. */
function dayLabel(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/**
 * Every calendar day of the event in its own zone, first to last, so the board has one tab per
 * day even when no session is placed on it yet. An event always has at least one day.
 */
export function eventDays(
  startAt: string,
  endAt: string,
  timezone: string,
): BoardDay[] {
  const lastKey = toFormDateTime(endAt, timezone).date;
  const days: BoardDay[] = [];
  let instant = Date.parse(startAt);

  while (days.length < MAX_DAYS) {
    const iso = new Date(instant).toISOString();
    const key = toFormDateTime(iso, timezone).date;
    if (days.length > 0 && key > lastKey) break;
    days.push({ index: days.length, key, label: dayLabel(iso, timezone) });
    if (key >= lastKey) break;
    instant += DAY_MS;
  }
  return days;
}

//* Placing a session on the board

/** "09:30" from minutes since midnight. */
export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** The hour labels down the left edge: 09:00 … 17:00. */
export function boardHours(): string[] {
  return Array.from(
    { length: BOARD_LAST_HOUR - BOARD_FIRST_HOUR },
    (_, offset) => formatMinute((BOARD_FIRST_HOUR + offset) * 60),
  );
}

/** Height of the whole board in px. */
export function boardHeight(): number {
  return (BOARD_LAST_HOUR - BOARD_FIRST_HOUR) * HOUR_PX;
}

/** Where a block sits in its hall's column, in px; clipped to the board's hours. */
export function blockBox(
  startMinute: number,
  endMinute: number,
): { top: number; height: number } {
  const first = BOARD_FIRST_HOUR * 60;
  const last = BOARD_LAST_HOUR * 60;
  const from = Math.max(startMinute, first);
  const to = Math.min(endMinute, last);
  return {
    top: ((from - first) / 60) * HOUR_PX,
    height: Math.max(((to - from) / 60) * HOUR_PX, 0),
  };
}

export type PlacedSession = SampleSession & {
  startMinute: number;
  endMinute: number;
  hallId: string;
  day: number;
};

export function isPlaced(session: SampleSession): session is PlacedSession {
  return (
    session.hallId !== null &&
    session.day !== null &&
    session.startMinute !== null &&
    session.endMinute !== null
  );
}

/** The sessions placed in one hall on one day, earliest first. */
export function sessionsInHall(
  sessions: readonly SampleSession[],
  day: number,
  hallId: string,
): PlacedSession[] {
  return sessions
    .filter(isPlaced)
    .filter((session) => session.day === day && session.hallId === hallId)
    .sort((a, b) => a.startMinute - b.startMinute);
}

/** The sessions waiting for a hall and a time. A cancelled session never needs one. */
export function unscheduledSessions(
  sessions: readonly SampleSession[],
): SampleSession[] {
  return sessions.filter((session) => !session.cancelled && !isPlaced(session));
}

/** "Meera Joshi, Vikram Mehta"; empty when the session has no speaker yet. */
export function speakerNames(
  session: SampleSession,
  speakers: readonly SampleSpeaker[],
): string {
  return session.speakerIds
    .map((id) => speakers.find((speaker) => speaker.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

/** "09:30–10:30" for a placed session. */
export function slotLabel(session: PlacedSession): string {
  return `${formatMinute(session.startMinute)}–${formatMinute(session.endMinute)}`;
}
