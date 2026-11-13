import type { SpeakerListItemDto } from "../../speakers";
import type { SessionDto } from "../schemas/sessions.schemas";

export type EventSpeakerRole = SessionDto["speakers"][number]["role"];

export type EventSpeakerRow = {
  /** speaker_profiles.id */
  id: string;
  name: string;
  /** The roles they have in this event's sessions, each once. */
  roles: EventSpeakerRole[];
  /** Titles of the sessions they present, in the order the sessions are given (the schedule). */
  sessionTitles: string[];
};

/**
 * The speakers of ONE event: everyone who presents at least one of its sessions that is still on,
 * with those sessions, by name. A speaker who is only on cancelled sessions is not listed, and a
 * speaker of another event never is: the rows come from this event's sessions only.
 */
export function eventSpeakerRows(
  sessions: readonly SessionDto[],
): EventSpeakerRow[] {
  const byId = new Map<string, EventSpeakerRow>();
  for (const session of sessions) {
    if (session.status === "cancelled") continue;
    for (const speaker of session.speakers) {
      const row = byId.get(speaker.speakerId) ?? {
        id: speaker.speakerId,
        name: speaker.name,
        roles: [],
        sessionTitles: [],
      };
      if (!row.roles.includes(speaker.role)) row.roles.push(speaker.role);
      row.sessionTitles.push(session.title);
      byId.set(speaker.speakerId, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** The rows whose name contains `term` (any case); every row for a blank term. */
export function searchEventSpeakers(
  rows: readonly EventSpeakerRow[],
  term: string,
): EventSpeakerRow[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

/** What a speaker's public profile lacks, as the Speakers tab words it. */
export type ProfileStatus = "complete" | "missing_photo" | "no_content";

export const PROFILE_STATUS_META: Record<
  ProfileStatus,
  { label: string; tone: "success" | "warning" }
> = {
  complete: { label: "Complete", tone: "success" },
  missing_photo: { label: "Missing photo", tone: "warning" },
  no_content: { label: "No profile content", tone: "warning" },
};

/** From the speaker's card in the speaker list: no content at all, no photo, or complete. */
export function profileStatus(
  speaker: Pick<SpeakerListItemDto, "profile">,
): ProfileStatus {
  if (!speaker.profile) return "no_content";
  return speaker.profile.photo ? "complete" : "missing_photo";
}
