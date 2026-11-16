import "server-only";
import { DrizzleQueryError } from "drizzle-orm";

/** The database constraint (migration 0009) that refuses two sessions in one hall at one time. */
export const HALL_OVERLAP_CONSTRAINT = "sessions_no_hall_overlap";

/**
 * Did the database refuse this write because another session holds the hall at that time? That is
 * Postgres's "exclusion_violation" (23P01) on the hall-overlap constraint, which only happens when
 * two saves race: the service's own check (assertHallFree) runs first and catches every other
 * clash. Drizzle wraps the driver's error, so the code and the constraint are on its `cause`.
 */
export function isHallClashError(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, constraint } = cause as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === "23P01" && constraint === HALL_OVERLAP_CONSTRAINT;
}
