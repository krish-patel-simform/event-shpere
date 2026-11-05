import type { SampleHall, SampleSession } from "../sample/organizer-sample";
import { plural } from "./event-display";

export type HallRow = SampleHall & {
  /** Sessions held in the hall that are not cancelled. */
  sessionCount: number;
  cancelledCount: number;
};

/** Each hall, in its order, with how many sessions of the event are placed in it. */
export function hallRows(
  halls: readonly SampleHall[],
  sessions: readonly SampleSession[],
): HallRow[] {
  return halls.map((hall) => {
    const inHall = sessions.filter((session) => session.hallId === hall.id);
    const cancelledCount = inHall.filter((session) => session.cancelled).length;
    return {
      ...hall,
      sessionCount: inHall.length - cancelledCount,
      cancelledCount,
    };
  });
}

/** "4 sessions · 1 cancelled", "1 session", "No sessions". */
export function hallSessionsText(row: HallRow): string {
  const held =
    row.sessionCount === 0 && row.cancelledCount === 0
      ? "No sessions"
      : plural(row.sessionCount + row.cancelledCount, "session");
  return row.cancelledCount > 0
    ? `${held} · ${row.cancelledCount} cancelled`
    : held;
}
