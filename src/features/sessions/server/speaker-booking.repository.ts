import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  sessionsTable,
  sessionSpeakersTable,
  speakersProfilesTable,
  usersTable,
} from "../../../db/schemas";

/**
 * A session HOLDS its speakers while it is not cancelled and has a time, whether it is a draft or
 * scheduled (the same rule as a hall, see hall-booking.repository): otherwise two organizers
 * could plan the same speaker at the same time and one would lose them when confirming a draft.
 * It does not matter which hall, which event or whether the session is online: a person cannot
 * be in two places at once.
 *
 * Two time ranges overlap when each one starts before the other ends:
 *   existing.start < new.end  AND  existing.end > new.start
 * The comparisons are strict, so a speaker who finishes at 12:00 can start again at 12:00.
 */
const holdingSpeakers = and(
  ne(sessionsTable.status, "cancelled"),
  // start_at and end_at are both set or both null (a check constraint), so one test is enough.
  isNotNull(sessionsTable.startAt),
);

/** One speaker who is busy, and when: never what the other session is or who owns it. */
export type SpeakerHeldSlot = {
  /** speaker_profiles.id */
  speakerId: string;
  /** The speaker's full name (from their user), for the message the organizer reads. */
  name: string;
  startAt: Date;
  endAt: Date;
};

export const speakerBookingRepository = {
  /**
   * The sessions that hold any of these speakers during [startAt, endAt), one row per speaker
   * and session, earliest first. `exceptSessionId` leaves one session out: the one being moved
   * or edited must not clash with its own old slot.
   */
  async findOverlappingSessions(params: {
    speakerIds: string[];
    startAt: Date;
    endAt: Date;
    exceptSessionId?: string;
  }): Promise<SpeakerHeldSlot[]> {
    if (params.speakerIds.length === 0) return [];

    const rows = await db
      .select({
        speakerId: sessionSpeakersTable.speakerId,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        startAt: sessionsTable.startAt,
        endAt: sessionsTable.endAt,
      })
      .from(sessionSpeakersTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, sessionSpeakersTable.sessionId),
      )
      // The name lives on the user the speaker profile belongs to.
      .innerJoin(
        speakersProfilesTable,
        eq(speakersProfilesTable.id, sessionSpeakersTable.speakerId),
      )
      .innerJoin(usersTable, eq(usersTable.id, speakersProfilesTable.userId))
      .where(
        and(
          inArray(sessionSpeakersTable.speakerId, params.speakerIds),
          holdingSpeakers,
          lt(sessionsTable.startAt, params.endAt),
          gt(sessionsTable.endAt, params.startAt),
          params.exceptSessionId
            ? ne(sessionsTable.id, params.exceptSessionId)
            : undefined,
        ),
      )
      .orderBy(sessionsTable.startAt);

    // The columns are nullable in the table; holdingSpeakers guarantees they are set here.
    return rows.flatMap((row) =>
      row.startAt && row.endAt
        ? [
            {
              speakerId: row.speakerId,
              name: `${row.firstName} ${row.lastName}`.trim(),
              startAt: row.startAt,
              endAt: row.endAt,
            },
          ]
        : [],
    );
  },
};

export type SpeakerBookingRepository = typeof speakerBookingRepository;
