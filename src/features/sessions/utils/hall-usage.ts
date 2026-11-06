import { plural } from "../../events";
import type { CreateHallDto } from "../../venues";
import type { SessionDto } from "../schemas/sessions.schemas";

export type HallRow = CreateHallDto & {
  /** Sessions of this event in the hall that are not cancelled. */
  sessionCount: number;
  /** Cancelled sessions of this event that had the hall. */
  cancelledCount: number;
};

/**
 * The venue's halls in the venue's own order (the order they are columns on the schedule board),
 * each with how many sessions of THIS event hold it. Sessions of other events are not counted: a
 * hall's bookings by other organizers are never shown here.
 */
export function hallRows(
  halls: readonly CreateHallDto[],
  sessions: readonly SessionDto[],
): HallRow[] {
  return [...halls]
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en"),
    )
    .map((hall) => {
      const inHall = sessions.filter((session) => session.hallId === hall.id);
      const cancelledCount = inHall.filter(
        (session) => session.status === "cancelled",
      ).length;
      return {
        ...hall,
        sessionCount: inHall.length - cancelledCount,
        cancelledCount,
      };
    });
}

/** "4 sessions · 1 cancelled", "1 session", "No sessions". */
export function hallSessionsText(row: HallRow): string {
  const all = row.sessionCount + row.cancelledCount;
  const held = all === 0 ? "No sessions" : plural(all, "session");
  return row.cancelledCount > 0
    ? `${held} · ${row.cancelledCount} cancelled`
    : held;
}
