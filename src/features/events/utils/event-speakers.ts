import type { SampleSession, SampleSpeaker } from "../sample/organizer-sample";

/** What a speaker's profile still lacks, as the Speakers tab words it. */
export const PROFILE_STATUS_META: Record<
  SampleSpeaker["profile"],
  { label: string; tone: "success" | "warning" }
> = {
  complete: { label: "Complete", tone: "success" },
  missing_photo: { label: "Missing photo", tone: "warning" },
  missing_bio: { label: "Missing bio", tone: "warning" },
};

export type SpeakerRow = SampleSpeaker & {
  /** Titles of the sessions they present, in the order of the schedule. */
  sessionTitles: string[];
};

/** Each speaker with the sessions they present; a cancelled session no longer counts. */
export function speakerRows(
  speakers: readonly SampleSpeaker[],
  sessions: readonly SampleSession[],
): SpeakerRow[] {
  return speakers.map((speaker) => ({
    ...speaker,
    sessionTitles: sessions
      .filter(
        (session) =>
          !session.cancelled && session.speakerIds.includes(speaker.id),
      )
      .map((session) => session.title),
  }));
}

/** The speakers whose name contains `term` (any case); every speaker for a blank term. */
export function searchSpeakers<Row extends { name: string }>(
  rows: readonly Row[],
  term: string,
): Row[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

/** How many speakers have something missing on their profile. */
export function incompleteProfiles(rows: readonly SpeakerRow[]): number {
  return rows.filter((row) => row.profile !== "complete").length;
}
