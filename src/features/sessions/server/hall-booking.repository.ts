import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { sessionsTable } from "../../../db/schemas";

/**
 * A session HOLDS its hall while it is not cancelled and has a time, whether it is a draft or
 * scheduled. If drafts did not count, one organizer could place a draft in a hall, another could
 * book the same hall at the same time, and the first would lose it when confirming the draft.
 *
 * Two time ranges overlap when each one starts before the other ends:
 *   existing.start < new.end  AND  existing.end > new.start
 * The comparisons are strict, so a session that ends at 12:00 does not clash with one that
 * starts at 12:00 (back to back is fine).
 */
const holdingHall = and(
  ne(sessionsTable.status, "cancelled"),
  // start_at and end_at are both set or both null (a check constraint), so one test is enough.
  isNotNull(sessionsTable.startAt),
);

/** The part of a session that others may see: when it is, never what it is or whose it is. */
export type HeldSlot = { id: string; startAt: Date; endAt: Date };

export const hallBookingRepository = {
  /**
   * The sessions that hold this hall during [startAt, endAt). `exceptSessionId` leaves one
   * session out: the one being moved or edited must not clash with its own old slot.
   */
  async findOverlappingSessions(params: {
    hallId: string;
    startAt: Date;
    endAt: Date;
    exceptSessionId?: string;
  }): Promise<HeldSlot[]> {
    const rows = await db
      .select({
        id: sessionsTable.id,
        startAt: sessionsTable.startAt,
        endAt: sessionsTable.endAt,
      })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.hallId, params.hallId),
          holdingHall,
          lt(sessionsTable.startAt, params.endAt),
          gt(sessionsTable.endAt, params.startAt),
          params.exceptSessionId
            ? ne(sessionsTable.id, params.exceptSessionId)
            : undefined,
        ),
      )
      .orderBy(sessionsTable.startAt);

    // The columns are nullable in the table; holdingHall guarantees they are set here.
    return rows.flatMap((row) =>
      row.startAt && row.endAt
        ? [{ id: row.id, startAt: row.startAt, endAt: row.endAt }]
        : [],
    );
  },

  /**
   * The times these halls are taken that fall inside [startAt, endAt), earliest first: one
   * query for the whole list, so a screen of halls does not ask once per hall. A hall that is
   * only partly taken still returns its slots, so the caller can show the free gaps.
   */
  async findHeldSlotsInHalls(params: {
    hallIds: string[];
    startAt: Date;
    endAt: Date;
  }): Promise<{ hallId: string; startAt: Date; endAt: Date }[]> {
    if (params.hallIds.length === 0) return [];

    const rows = await db
      .select({
        hallId: sessionsTable.hallId,
        startAt: sessionsTable.startAt,
        endAt: sessionsTable.endAt,
      })
      .from(sessionsTable)
      .where(
        and(
          inArray(sessionsTable.hallId, params.hallIds),
          holdingHall,
          lt(sessionsTable.startAt, params.endAt),
          gt(sessionsTable.endAt, params.startAt),
        ),
      )
      .orderBy(sessionsTable.startAt);

    // The columns are nullable in the table; the query above guarantees they are set.
    return rows.flatMap((row) =>
      row.hallId && row.startAt && row.endAt
        ? [{ hallId: row.hallId, startAt: row.startAt, endAt: row.endAt }]
        : [],
    );
  },
};

export type HallBookingRepository = typeof hallBookingRepository;
