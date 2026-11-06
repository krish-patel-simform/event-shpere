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
