import type { SessionDto } from "../schemas/sessions.schemas";

/**
 * The sessions whose title, hall name or any speaker's name contains the typed text (ignoring
 * case and the spaces around it). Nothing typed shows every session. The order is kept.
 */
export function filterSessionsBySearch(
  sessions: readonly SessionDto[],
  term: string,
): SessionDto[] {
  const needle = term.trim().toLowerCase();
  if (needle === "") return [...sessions];

  return sessions.filter((session) =>
    [
      session.title,
      session.hallName ?? "",
      ...session.speakers.map((speaker) => speaker.name),
    ].some((text) => text.toLowerCase().includes(needle)),
  );
}
