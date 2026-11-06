import type { SelectOption } from "@/src/core/ui";
import { plural } from "../../events";
import type { SessionDto } from "../schemas/sessions.schemas";

/** The filter's value for "every session": the select's own "clear" row gives "". */
export const ALL_HALLS = "";
/** The filter's value for the sessions that have no hall (online ones). */
export const NO_HALL = "none";

/** A hall as the filter needs it. The venue's halls come with an order. */
export type FilterHall = { id: string; name: string; sortOrder?: number };

/**
 * The options of the hall filter: the halls of the event's venue in the venue's order, then any
 * hall a session uses that the venue list does not hold (an inactive hall an organizer no longer
 * sees keeps its sessions), then "No hall (online)" when some session has none. Each option says
 * how many sessions it would show, and that hint is searched too. Everything is built in the
 * browser from what is already loaded.
 */
export function hallFilterOptions(
  halls: readonly FilterHall[],
  sessions: readonly SessionDto[],
): SelectOption[] {
  const counts = new Map<string, number>();
  let withoutHall = 0;
  for (const session of sessions) {
    if (session.hallId === null) withoutHall += 1;
    else counts.set(session.hallId, (counts.get(session.hallId) ?? 0) + 1);
  }

  const known = new Map<string, string>();
  [...halls]
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name, "en"),
    )
    .forEach((hall) => known.set(hall.id, hall.name));
  // A hall only the sessions know about: its name comes from the session.
  for (const session of sessions) {
    if (session.hallId && session.hallName && !known.has(session.hallId)) {
      known.set(session.hallId, session.hallName);
    }
  }

  const options: SelectOption[] = [...known].map(([id, name]) => ({
    value: id,
    label: name,
    hint: plural(counts.get(id) ?? 0, "session"),
  }));
  if (withoutHall > 0) {
    options.push({
      value: NO_HALL,
      label: "No hall (online)",
      hint: plural(withoutHall, "session"),
    });
  }
  return options;
}

/** The sessions in the chosen hall; every session for "all", the hall-less ones for "none". */
export function filterSessionsByHall(
  sessions: readonly SessionDto[],
  hall: string,
): SessionDto[] {
  if (hall === ALL_HALLS) return [...sessions];
  if (hall === NO_HALL) {
    return sessions.filter((session) => session.hallId === null);
  }
  return sessions.filter((session) => session.hallId === hall);
}
