import { formatEventDates, formatEventTimes } from "../../events";
import type { PublicSessionDetailDto } from "../schemas/session-public.schemas";

export const PUBLIC_SESSION_MODE_LABELS: Record<
  PublicSessionDetailDto["mode"],
  string
> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};

/** A speaker's role is only named when it is not the usual one. */
export const PUBLIC_SPEAKER_ROLE_LABELS: Record<
  PublicSessionDetailDto["speakers"][number]["role"],
  string
> = {
  speaker: "Speaker",
  moderator: "Moderator",
  host: "Host",
};

/** "Sat 12 Dec 2026" and "10:00 – 11:00 IST", in the event's zone; null until it has a slot. */
export function sessionWhen(
  session: Pick<PublicSessionDetailDto, "startAt" | "endAt" | "event">,
): { date: string; time: string } | null {
  const { startAt, endAt, event } = session;
  if (!startAt || !endAt) return null;
  return {
    date: formatEventDates(startAt, endAt, event.timezone, { weekday: true }),
    time: formatEventTimes(startAt, endAt, event.timezone),
  };
}

/** "Main Hall", or "Online" when there is no hall. */
export function sessionPlace(
  session: Pick<PublicSessionDetailDto, "hallName">,
): string {
  return session.hallName ?? "Online";
}

/**
 * Where to go, in one line: "Hall A · Tech Park Auditorium, Pune". An online session is "Online"
 * (the join link is never public); a hybrid one adds "Also live online".
 */
export function sessionWhere(
  session: Pick<PublicSessionDetailDto, "mode" | "hallName" | "venue">,
): string {
  if (session.mode === "online") return "Online";
  const parts = [
    session.hallName,
    session.venue ? `${session.venue.name}, ${session.venue.city}` : null,
  ].filter((part) => part !== null);
  if (session.mode === "hybrid") parts.push("Also live online");
  return parts.length > 0 ? parts.join(" · ") : "Place to be announced";
}

/** How full the hall is, 0–100, for the seats bar. */
export function seatsTakenPercent(capacity: number, seatsLeft: number): number {
  if (capacity <= 0) return 0;
  const taken = Math.min(Math.max(capacity - seatsLeft, 0), capacity);
  return Math.round((taken / capacity) * 100);
}
