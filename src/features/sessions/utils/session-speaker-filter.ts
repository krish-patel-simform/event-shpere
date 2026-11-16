import type { SessionDto } from "../schemas/sessions.schemas";

/** The sessions the speaker presents (cancelled ones too: the list shows them as cancelled). */
export function filterSessionsBySpeaker(
  sessions: readonly SessionDto[],
  speakerId: string,
): SessionDto[] {
  return sessions.filter((session) =>
    session.speakers.some((speaker) => speaker.speakerId === speakerId),
  );
}

/** The speaker's name as the sessions carry it; undefined when no session has them. */
export function speakerNameIn(
  sessions: readonly SessionDto[],
  speakerId: string,
): string | undefined {
  for (const session of sessions) {
    const found = session.speakers.find(
      (speaker) => speaker.speakerId === speakerId,
    );
    if (found) return found.name;
  }
  return undefined;
}
