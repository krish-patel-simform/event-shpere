import type {
  PublicEventDetailDto,
  PublicSessionDto,
} from "../schemas/event-public.schemas";
import { toFormDateTime } from "./event-display";

//* Labels

export const PUBLIC_SESSION_TYPE_LABELS: Record<
  PublicSessionDto["type"],
  string
> = {
  talk: "Talk",
  workshop: "Workshop",
  panel: "Panel",
  keynote: "Keynote",
};

//* The schedule, by day

/** A session that has its time set: only these can be placed on the programme. */
export type TimedSession = PublicSessionDto & {
  startAt: string;
  endAt: string;
};

export function isTimed(session: PublicSessionDto): session is TimedSession {
  return session.startAt !== null && session.endAt !== null;
}

export type ScheduleDay = {
  /** The day in the event's zone: "2026-12-03". */
  key: string;
  /** "Thu 3". */
  label: string;
  sessions: TimedSession[];
};

/** "Thu 3", in the event's zone. */
function dayLabel(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")}`;
}

/**
 * The sessions that have a time, grouped by the day they start (in the event's zone), days in
 * order and each day's sessions earliest first. Sessions without a time are left out.
 */
export function groupSessionsByDay(
  sessions: readonly PublicSessionDto[],
  timezone: string,
): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>();
  const ordered = sessions
    .filter(isTimed)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

  for (const session of ordered) {
    const key = toFormDateTime(session.startAt, timezone).date;
    const day = days.get(key) ?? {
      key,
      label: dayLabel(session.startAt, timezone),
      sessions: [],
    };
    day.sessions.push(session);
    days.set(key, day);
  }
  return [...days.values()];
}

/** "09:30": the start time of a session, in the event's zone. */
export function sessionStartTime(session: TimedSession, timezone: string) {
  return toFormDateTime(session.startAt, timezone).time;
}

/** Whole minutes between the start and the end. */
export function sessionMinutes(session: TimedSession): number {
  return Math.round(
    (Date.parse(session.endAt) - Date.parse(session.startAt)) / 60_000,
  );
}

//* Speakers

export type EventSpeaker = {
  slug: string;
  name: string;
  /** How many of the event's sessions they speak in. */
  sessionCount: number;
};

/** The speakers of the event, taken from its sessions, in the order they first appear. */
export function eventSpeakers(
  sessions: PublicEventDetailDto["sessions"],
): EventSpeaker[] {
  const speakers = new Map<string, EventSpeaker>();
  for (const session of sessions) {
    for (const { slug, name } of session.speakers) {
      const known = speakers.get(slug);
      if (known) known.sessionCount += 1;
      else speakers.set(slug, { slug, name, sessionCount: 1 });
    }
  }
  return [...speakers.values()];
}

//* Text

/** Plain text where a blank line starts a new paragraph. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
