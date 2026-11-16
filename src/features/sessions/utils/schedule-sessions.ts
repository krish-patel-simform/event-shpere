import { toMinutes } from "@/src/core/format/time-key";
import { toFormDateTime, toIsoWithOffset } from "../../events";
import type { CreateHallDto } from "../../venues";
import type { SessionDto } from "../schemas/sessions.schemas";
import {
  dayLabel,
  type BoardDay,
  type BoardHall,
  type BoardSession,
} from "./schedule-board";

// Turns what the API sends into what the schedule board draws, and a move on the board back into
// the request the API takes.

/** The venue's halls in the venue's own order: the order of the board's columns. */
export function toBoardHalls(halls: readonly CreateHallDto[]): BoardHall[] {
  return [...halls]
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en"),
    )
    .map((hall) => ({
      id: hall.id,
      name: hall.name,
      seats: hall.capacity,
      active: hall.isActive,
    }));
}

export type ScheduleSessions = {
  /** Sessions with a hall and a time on one of the event's days: the board draws these. */
  placed: BoardSession[];
  /** The others (an online session has no hall): listed beside the board, not drawn on it. */
  other: SessionDto[];
};

/**
 * Splits the event's sessions into those the board can draw and the rest. `locked` is an event
 * that can not change any more (cancelled or completed): nothing on its board can be moved. A
 * session can not be moved either when it is cancelled or its end has passed (the API refuses
 * both).
 */
export function toScheduleSessions(
  sessions: readonly SessionDto[],
  context: {
    days: readonly BoardDay[];
    halls: readonly BoardHall[];
    timezone: string;
    now: Date;
    locked: boolean;
  },
): ScheduleSessions {
  const placed: BoardSession[] = [];
  const other: SessionDto[] = [];

  for (const session of sessions) {
    const board = toBoardSession(session, context);
    if (board) placed.push(board);
    else other.push(session);
  }
  return { placed, other: other.sort(byActiveThenStart) };
}

/** Sessions that still run first, earliest first; cancelled ones after them; no time last. */
function byActiveThenStart(a: SessionDto, b: SessionDto): number {
  const cancelled =
    Number(a.status === "cancelled") - Number(b.status === "cancelled");
  if (cancelled !== 0) return cancelled;
  const start = (session: SessionDto) =>
    session.startAt ? Date.parse(session.startAt) : Infinity;
  return start(a) === start(b) ? 0 : start(a) < start(b) ? -1 : 1;
}

/**
 * When a session takes place, for a list: "Sat 12 Dec · 10:00–11:00" in the event's zone, or null
 * when it has no time yet. A session that runs into the next day names both days.
 */
export function sessionWhen(
  session: SessionDto,
  timezone: string,
): string | null {
  if (!session.startAt || !session.endAt) return null;
  const start = toFormDateTime(session.startAt, timezone);
  const end = toFormDateTime(session.endAt, timezone);
  const day = dayLabel(session.startAt, timezone);
  if (end.date === start.date) return `${day} · ${start.time}–${end.time}`;
  return `${day} ${start.time} – ${dayLabel(session.endAt, timezone)} ${end.time}`;
}

function toBoardSession(
  session: SessionDto,
  {
    days,
    halls,
    timezone,
    now,
    locked,
  }: Parameters<typeof toScheduleSessions>[1],
): BoardSession | null {
  const { hallId, startAt, endAt } = session;
  if (!hallId || !startAt || !endAt) return null;
  if (!halls.some((hall) => hall.id === hallId)) return null;

  const start = toFormDateTime(startAt, timezone);
  const end = toFormDateTime(endAt, timezone);
  const day = days.findIndex((item) => item.key === start.date);
  const startMinute = toMinutes(start.time);
  const endTime = toMinutes(end.time);
  if (day === -1 || startMinute === null || endTime === null) return null;
  // A session that runs past midnight is drawn to the end of its day.
  const endMinute = end.date === start.date ? endTime : 24 * 60;

  const cancelled = session.status === "cancelled";
  return {
    id: session.id,
    title: session.title,
    type: session.type,
    hallId,
    day,
    startMinute,
    endMinute,
    // In the order the speakers were given (the API may list them in any order).
    speakers: [...session.speakers]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((speaker) => ({ id: speaker.speakerId, name: speaker.name })),
    cancelled,
    movable: !locked && !cancelled && new Date(endAt) > now,
  };
}

/** What moving a session sends: its hall and its new start and end (UTC instants). */
export type SessionMove = { hallId: string; startAt: string; endAt: string };

/**
 * The request that moves a session to where the board now has it: its hall and its new start and
 * end. Times are built from the day and the minutes, so a block that ends at midnight is fine.
 */
export function toMoveRequest(
  moved: BoardSession,
  days: readonly BoardDay[],
): SessionMove {
  const midnight = Date.parse(toIsoWithOffset(days[moved.day].key, "00:00"));
  const at = (minute: number) =>
    new Date(midnight + minute * 60_000).toISOString();
  return {
    hallId: moved.hallId,
    startAt: at(moved.startMinute),
    endAt: at(moved.endMinute),
  };
}

/** The session list with one session moved: what the board shows while the move is saved. */
export function withSessionMoved(
  sessions: readonly SessionDto[],
  sessionId: string,
  move: SessionMove,
  hallName: string | null,
): SessionDto[] {
  return sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          hallId: move.hallId,
          hallName,
          startAt: move.startAt,
          endAt: move.endAt,
        }
      : session,
  );
}
