import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  eventsTable,
  hallsTable,
  sessionRegistrationsTable,
  sessionSpeakersTable,
  sessionsTable,
  venuesTable,
} from "../../../db/schemas";
import type { SpeakerSessionTimeline } from "../schemas/speaker-sessions.schemas";

export type SpeakerSessionRow = {
  id: string;
  title: string;
  type: typeof sessionsTable.$inferSelect.type;
  mode: typeof sessionsTable.$inferSelect.mode;
  startAt: Date;
  endAt: Date;
  hallName: string | null;
  /** Seats in the hall; null = no hall (online). */
  hallCapacity: number | null;
  price: number;
  requiresRegistration: boolean;
  /** Seats booked right now (cancelled bookings are not counted). */
  booked: number;
};

export type SpeakerSessionGroupRow = {
  event: {
    slug: string;
    title: string;
    startAt: Date;
    endAt: Date;
    timezone: string;
    venueName: string | null;
    venueCity: string | null;
    ticketPrice: number;
  };
  sessions: SpeakerSessionRow[];
};

/**
 * Where a session sits in time, by the database clock. `now` = started and not over, `upcoming`
 * = starts later, `past` = over. A session without times (a draft) matches none of them.
 */
function timelineCondition(timeline: SpeakerSessionTimeline): SQL | undefined {
  switch (timeline) {
    case "now":
      return and(
        lte(sessionsTable.startAt, sql`now()`),
        gt(sessionsTable.endAt, sql`now()`),
      );
    case "upcoming":
      return gt(sessionsTable.startAt, sql`now()`);
    case "past":
      return lte(sessionsTable.endAt, sql`now()`);
  }
}

export const speakerSessionRepository = {
  /**
   * A page of the events where the speaker has sessions in the given category, each with those
   * sessions, plus how many events and sessions the category has in all. Only what the public may
   * see: a SCHEDULED session of a PUBLISHED event (a draft or cancelled session, a draft or
   * cancelled event are never listed). Events are ordered by their own start date: soonest first,
   * except `past` (latest first).
   *
   * Two queries, run together: the totals, and one joined query for the page. A page is a number
   * of EVENTS, not rows (a row is one session), so a subquery first picks the event ids of the
   * page, and the joined query loads every matching session of those events.
   */
  async listSpeakerSessions(params: {
    /** speaker_profiles.id */
    speakerId: string;
    timeline: SpeakerSessionTimeline;
    limit: number;
    offset: number;
  }): Promise<{
    groups: SpeakerSessionGroupRow[];
    totalEvents: number;
    totalSessions: number;
  }> {
    const { speakerId, timeline } = params;
    const matches = and(
      eq(sessionSpeakersTable.speakerId, speakerId),
      eq(sessionsTable.status, "scheduled"),
      eq(eventsTable.status, "published"),
      timelineCondition(timeline),
    );
    // Soonest event first; past events: the most recent first. id breaks ties, so paging never
    // shows an event twice or skips one.
    const eventOrder = [
      timeline === "past"
        ? desc(eventsTable.startAt)
        : asc(eventsTable.startAt),
      asc(eventsTable.id),
    ];

    // The ids of the events on this page.
    const eventPage = db
      .select({ id: eventsTable.id })
      .from(sessionsTable)
      .innerJoin(
        sessionSpeakersTable,
        eq(sessionSpeakersTable.sessionId, sessionsTable.id),
      )
      .innerJoin(eventsTable, eq(eventsTable.id, sessionsTable.eventId))
      .where(matches)
      .groupBy(eventsTable.id)
      .orderBy(...eventOrder)
      .limit(params.limit)
      .offset(params.offset);

    const [[totals], rows] = await Promise.all([
      db
        .select({
          events: sql<number>`count(distinct ${eventsTable.id})::int`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(sessionsTable)
        .innerJoin(
          sessionSpeakersTable,
          eq(sessionSpeakersTable.sessionId, sessionsTable.id),
        )
        .innerJoin(eventsTable, eq(eventsTable.id, sessionsTable.eventId))
        .where(matches),
      db
        .select({
          eventSlug: eventsTable.slug,
          eventTitle: eventsTable.title,
          eventStartAt: eventsTable.startAt,
          eventEndAt: eventsTable.endAt,
          eventTimezone: eventsTable.timezone,
          ticketPrice: eventsTable.ticketPrice,
          venueName: venuesTable.name,
          venueCity: venuesTable.city,
          id: sessionsTable.id,
          title: sessionsTable.title,
          type: sessionsTable.type,
          mode: sessionsTable.mode,
          startAt: sessionsTable.startAt,
          endAt: sessionsTable.endAt,
          price: sessionsTable.price,
          requiresRegistration: sessionsTable.requiresRegistration,
          hallName: hallsTable.name,
          hallCapacity: hallsTable.capacity,
          booked: sql<number>`(
            select count(*)::int from ${sessionRegistrationsTable}
            where ${sessionRegistrationsTable.sessionId} = ${sessionsTable.id}
              and ${sessionRegistrationsTable.status} = 'registered'
          )`,
        })
        .from(sessionsTable)
        .innerJoin(
          sessionSpeakersTable,
          eq(sessionSpeakersTable.sessionId, sessionsTable.id),
        )
        .innerJoin(eventsTable, eq(eventsTable.id, sessionsTable.eventId))
        .leftJoin(venuesTable, eq(venuesTable.id, eventsTable.venueId))
        .leftJoin(hallsTable, eq(hallsTable.id, sessionsTable.hallId))
        .where(and(matches, inArray(eventsTable.id, eventPage)))
        .orderBy(
          ...eventOrder,
          asc(sessionsTable.startAt),
          asc(sessionsTable.id),
        ),
    ]);

    // One row per session: put each session in its event's group. A Map keeps the groups in the
    // order they first appeared, which is the order the query already gave.
    const groups = new Map<string, SpeakerSessionGroupRow>();
    for (const row of rows) {
      // The timeline filter already left out sessions with no times; this narrows the type.
      if (!row.startAt || !row.endAt) continue;

      const group = groups.get(row.eventSlug) ?? {
        event: {
          slug: row.eventSlug,
          title: row.eventTitle,
          startAt: row.eventStartAt,
          endAt: row.eventEndAt,
          timezone: row.eventTimezone,
          venueName: row.venueName,
          venueCity: row.venueCity,
          ticketPrice: row.ticketPrice,
        },
        sessions: [],
      };
      group.sessions.push({
        id: row.id,
        title: row.title,
        type: row.type,
        mode: row.mode,
        startAt: row.startAt,
        endAt: row.endAt,
        hallName: row.hallName,
        hallCapacity: row.hallCapacity,
        price: row.price,
        requiresRegistration: row.requiresRegistration,
        booked: row.booked,
      });
      groups.set(row.eventSlug, group);
    }

    return {
      groups: [...groups.values()],
      totalEvents: totals?.events ?? 0,
      totalSessions: totals?.sessions ?? 0,
    };
  },
};

export type SpeakerSessionRepository = typeof speakerSessionRepository;
