import type {
  sessionModeEnum,
  sessionSpeakerRoleEnum,
  sessionTypeEnum,
  SessionStatus,
} from "../../../db/schemas";
import {
  formatEventDates,
  formatTicketPrice,
  toFormDateTime,
  zoneLabel,
} from "../../events";
import type { SessionDto } from "../schemas/sessions.schemas";

// How the organizer's pages say what a session is. Plain functions and data, no React.

type SessionType = (typeof sessionTypeEnum.enumValues)[number];
type SessionMode = (typeof sessionModeEnum.enumValues)[number];
type SessionSpeakerRole = (typeof sessionSpeakerRoleEnum.enumValues)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  talk: "Talk",
  workshop: "Workshop",
  panel: "Panel",
  keynote: "Keynote",
};

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};

export const SESSION_SPEAKER_ROLE_LABELS: Record<SessionSpeakerRole, string> = {
  speaker: "Speaker",
  moderator: "Moderator",
  host: "Host",
};

/** The label and badge colour of each status. A cancelled session is final. */
export const SESSION_STATUS_META: Record<
  SessionStatus,
  { label: string; tone: "neutral" | "success" | "danger" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

/** "Thu 3 Dec 2026", in the event's zone; a session without a slot yet has no day. */
export function sessionDay(
  session: Pick<SessionDto, "startAt">,
  timezone: string,
): string | null {
  if (!session.startAt) return null;
  return formatEventDates(session.startAt, session.startAt, timezone, {
    weekday: true,
  });
}

/** "10:00 – 11:00 IST", in the event's zone; null while the session has no slot. */
export function sessionTimes(
  session: Pick<SessionDto, "startAt" | "endAt">,
  timezone: string,
): string | null {
  if (!session.startAt || !session.endAt) return null;
  const start = toFormDateTime(session.startAt, timezone).time;
  const end = toFormDateTime(session.endAt, timezone).time;
  return `${start} – ${end} ${zoneLabel(timezone)}`;
}

/** "Hall A", "Hall A + online" for a hybrid session, "Online" when there is no hall. */
export function sessionPlace(
  session: Pick<SessionDto, "mode" | "hallName">,
): string {
  if (!session.hallName) return SESSION_MODE_LABELS[session.mode];
  return session.mode === "hybrid"
    ? `${session.hallName} + online`
    : session.hallName;
}

/** The speakers' names in their display order: "Ananya Rao, Rohan Mehta". */
export function speakerNames(session: Pick<SessionDto, "speakers">): string {
  return [...session.speakers]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((speaker) => speaker.name)
    .join(", ");
}

/** "Included" in the event ticket, or the extra price ("₹500"). */
export function sessionPrice(session: Pick<SessionDto, "price">): string {
  return session.price === 0 ? "Included" : formatTicketPrice(session.price);
}
