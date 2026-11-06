import { toFormDateTime } from "../../events";

// The schedule board's maths, with no React in it: which days it has, where a session is drawn,
// where a drop puts it, and what stops it from going there. The board shows the sessions of an
// event that have a hall and a time: one column per hall, one row per hour.

//* The board's frame

/** Height of one hour on the board, in px. */
export const HOUR_PX = 64;

/** The hours the board shows: `firstHour` up to `lastHour` (24-hour clock, `lastHour` is excluded). */
export type BoardFrame = { firstHour: number; lastHour: number };

/** Nine to six, which grows when a session falls outside it. */
export const DEFAULT_FRAME: BoardFrame = { firstHour: 9, lastHour: 18 };

const DAY_MS = 86_400_000;
/** A guard for a badly dated event: more than this many days are not drawn. */
const MAX_DAYS = 20;

export type BoardDay = {
  /** 0 = the event's first day. */
  index: number;
  /** The day in the event's zone: "2026-12-03". */
  key: string;
  /** "Thu 3 Dec". */
  label: string;
};

export type BoardHall = {
  id: string;
  name: string;
  seats: number;
  /** An inactive hall keeps its sessions but can not take another one. */
  active: boolean;
};

/** A session that has a hall and a time, as the board draws it. */
export type BoardSession = {
  id: string;
  title: string;
  type: "talk" | "workshop" | "panel" | "keynote";
  hallId: string;
  /** Index of the event day it is on (0 = the first day). */
  day: number;
  /** Minutes since midnight in the event's zone (9:30 = 570). */
  startMinute: number;
  endMinute: number;
  speakers: readonly { id: string; name: string }[];
  cancelled: boolean;
  /** False for a session that can not be moved: cancelled, over, or in an event that is locked. */
  movable: boolean;
};

/** "Thu 3 Dec", in the event's zone. */
export function dayLabel(iso: string, timezone: string): string {
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

/** The frame that shows nine to six and every session: it grows by whole hours when needed. */
export function frameFor(sessions: readonly BoardSession[]): BoardFrame {
  let { firstHour, lastHour } = DEFAULT_FRAME;
  for (const session of sessions) {
    firstHour = Math.min(firstHour, Math.floor(session.startMinute / 60));
    lastHour = Math.max(lastHour, Math.ceil(session.endMinute / 60));
  }
  return { firstHour, lastHour: Math.min(lastHour, 24) };
}

//* Drawing a session

/** "09:30" from minutes since midnight. */
export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** The hour labels down the left edge: 09:00 … 17:00. */
export function boardHours(frame: BoardFrame): string[] {
  return Array.from({ length: frame.lastHour - frame.firstHour }, (_, offset) =>
    formatMinute((frame.firstHour + offset) * 60),
  );
}

/** Height of the whole board in px. */
export function boardHeight(frame: BoardFrame): number {
  return (frame.lastHour - frame.firstHour) * HOUR_PX;
}

/** Where a block sits in its hall's column, in px; clipped to the board's hours. */
export function blockBox(
  startMinute: number,
  endMinute: number,
  frame: BoardFrame,
): { top: number; height: number } {
  const first = frame.firstHour * 60;
  const last = frame.lastHour * 60;
  const from = Math.max(startMinute, first);
  const to = Math.min(endMinute, last);
  return {
    top: ((from - first) / 60) * HOUR_PX,
    height: Math.max(((to - from) / 60) * HOUR_PX, 0),
  };
}

/** The sessions in one hall on one day, earliest first. */
export function sessionsInHall(
  sessions: readonly BoardSession[],
  day: number,
  hallId: string,
): BoardSession[] {
  return sessions
    .filter((session) => session.day === day && session.hallId === hallId)
    .sort((a, b) => a.startMinute - b.startMinute);
}

/** "Meera Joshi, Vikram Mehta"; empty when the session has no speaker yet. */
export function speakerNames(session: BoardSession): string {
  return session.speakers.map((speaker) => speaker.name).join(", ");
}

/** "09:30–10:30" for a session. */
export function slotLabel(session: BoardSession): string {
  return `${formatMinute(session.startMinute)}–${formatMinute(session.endMinute)}`;
}

//* Moving a session on the board

/** A block lands on a multiple of this many minutes. */
export const SNAP_MINUTES = 15;

/** Minutes since midnight for a vertical offset (px) from the top of a hall column, snapped. */
export function minuteFromOffset(offset: number, frame: BoardFrame): number {
  const raw = frame.firstHour * 60 + (offset / HOUR_PX) * 60;
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
}

export type MoveTarget = { hallId: string; day: number; startMinute: number };

/**
 * The session at the target. It keeps its length, and the start is pulled inside the board's
 * hours so the whole block stays visible.
 */
export function moveSession(
  session: BoardSession,
  target: MoveTarget,
  frame: BoardFrame,
): BoardSession {
  const length = session.endMinute - session.startMinute;
  const first = frame.firstHour * 60;
  const lastStart = Math.max(frame.lastHour * 60 - length, first);
  const startMinute = Math.min(Math.max(target.startMinute, first), lastStart);
  return {
    ...session,
    hallId: target.hallId,
    day: target.day,
    startMinute,
    endMinute: startMinute + length,
  };
}

export type MoveClash = {
  /** `hall` = the hall is busy; `speaker` = one of the speakers is in another hall then. */
  kind: "hall" | "speaker";
  with: BoardSession;
};

/**
 * What stops the moved session from holding its new slot, or null when the slot is free. The
 * same rules the server applies: a cancelled session blocks nothing, back-to-back is fine, and
 * the hall's clash is reported before a speaker's. The session's own old slot does not count.
 */
export function findMoveClash(
  sessions: readonly BoardSession[],
  moved: BoardSession,
): MoveClash | null {
  const overlapping = sessions.filter(
    (other) =>
      other.id !== moved.id &&
      !other.cancelled &&
      other.day === moved.day &&
      other.startMinute < moved.endMinute &&
      other.endMinute > moved.startMinute,
  );

  const hall = overlapping.find((other) => other.hallId === moved.hallId);
  if (hall) return { kind: "hall", with: hall };

  const sharesSpeaker = (other: BoardSession) =>
    other.speakers.some((speaker) =>
      moved.speakers.some((mine) => mine.id === speaker.id),
    );
  const speaker = overlapping.find(sharesSpeaker);
  return speaker ? { kind: "speaker", with: speaker } : null;
}

/** What a dragged block is over: a hall's column, or a day's tab. */
export type DropZone =
  | {
      kind: "hall";
      hallId: string;
      /** Top edge of the column on screen, in px. */
      top: number;
    }
  | { kind: "day"; day: number };

/**
 * Where a drop puts the session. Over a hall's column, the block's top edge on screen gives the
 * start time in that hall on the day being shown. Over a day's tab, the session keeps its hall
 * and its time and only changes day.
 */
export function dropTarget(
  session: BoardSession,
  zone: DropZone,
  shownDay: number,
  blockTop: number,
  frame: BoardFrame,
): MoveTarget {
  if (zone.kind === "day") {
    return {
      hallId: session.hallId,
      day: zone.day,
      startMinute: session.startMinute,
    };
  }
  return {
    hallId: zone.hallId,
    day: shownDay,
    startMinute: minuteFromOffset(blockTop - zone.top, frame),
  };
}

/** Says why a slot is refused, for the message on the board. */
export function describeClash(
  clash: MoveClash,
  moved: BoardSession,
  halls: readonly BoardHall[],
): string {
  const other = `"${clash.with.title}" at ${slotLabel(clash.with)}`;
  if (clash.kind === "hall") {
    const hall = halls.find((item) => item.id === moved.hallId);
    return `${hall?.name ?? "This hall"} is busy: ${other}.`;
  }
  const shared = moved.speakers.find((speaker) =>
    clash.with.speakers.some((theirs) => theirs.id === speaker.id),
  );
  return `${shared?.name ?? "A speaker"} is already in ${other}.`;
}

/** What a dragged block is held over that can open another day. */
export type DayHover =
  { kind: "day"; day: number } | { kind: "step"; by: -1 | 1 };

/**
 * The day that holding the block over `hover` opens, or null when it opens nothing: no hover, the
 * day already shown, or a step past the first or last day.
 */
export function dayToOpen(
  hover: DayHover | null,
  shownDay: number,
  dayCount: number,
): number | null {
  if (!hover) return null;
  const day = hover.kind === "day" ? hover.day : shownDay + hover.by;
  return day !== shownDay && day >= 0 && day < dayCount ? day : null;
}
