import "server-only";
import {
  and,
  asc,
  desc,
  DrizzleQueryError,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../db/dbClient";
import { escapeLike } from "../../../db/escape-like";
import {
  eventCheckInsTable,
  eventRegistrationsTable,
  eventsTable,
  hallsTable,
  sessionCheckInsTable,
  sessionRegistrationsTable,
  sessionsTable,
  sessionSpeakersTable,
  speakersProfilesTable,
  usersTable,
  venuesTable,
  type EventCheckIn,
  type EventRecord,
  type EventRegistration,
  type SessionCheckIn,
  type SessionMode,
  type SessionRegistration,
  type SessionStatus,
} from "../../../db/schemas";
import type {
  AttendeeCounts,
  AttendeeListQuery,
  SessionAttendeeCounts,
} from "../schemas/attendees.schemas";
import type { CheckInListQuery } from "../schemas/check-ins.schemas";
import type { MyRegistrationListQuery } from "../schemas/registrations.schemas";

/** What `db.transaction` hands to its callback: the same queries, inside the transaction. */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const TICKET_CODE_UNIQUE = "event_registrations_ticket_code_unique";

/** True when Postgres rejected an insert because the ticket code already exists (23505). */
function isTicketCodeCollision(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (typeof cause !== "object" || cause === null) return false;
  const { code, constraint } = cause as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === "23505" && constraint === TICKET_CODE_UNIQUE;
}

/** The session fields a booking decision needs, with the capacity of its hall (null: no hall yet). */
export type SessionForBooking = {
  id: string;
  eventId: string;
  status: SessionStatus;
  /** Online sessions have no hall, so they have no hall capacity either. */
  mode: SessionMode;
  startAt: Date | null;
  endAt: Date | null;
  requiresRegistration: boolean;
  /** Paise on top of the event ticket; 0 = included. */
  price: number;
  hallCapacity: number | null;
};

/** One row of "My tickets": the registration, the event it is for, and the user's booked sessions. */
export type MyRegistrationRow = {
  registration: EventRegistration;
  event: Pick<
    EventRecord,
    | "id"
    | "slug"
    | "title"
    | "status"
    | "startAt"
    | "endAt"
    | "timezone"
    | "ticketPrice"
    | "currency"
    | "registrationClosesAt"
  >;
  venueName: string | null;
  venueCity: string | null;
  bookedSessionCount: number;
};

/** One row of the organizer's attendee list: the registration, its person, and the latest check-in. */
export type AttendeeRow = {
  registrationId: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketCode: string;
  status: EventRegistration["status"];
  registeredAt: Date;
  checkedInAt: Date | null;
  /** Who did the check-in (null: not checked in, or no staff member recorded) and how. */
  checkedByFirstName: string | null;
  checkedByLastName: string | null;
  checkInMethod: EventCheckIn["method"] | null;
};

/** One row of a session's attendee list: the seat, its person, their event ticket and the session check-in. */
export type SessionAttendeeRow = {
  bookingId: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketCode: string;
  status: SessionRegistration["status"];
  bookedAt: Date;
  checkedInAt: Date | null;
};

/** One line of the check-in log: the check-in, the person it is for and who did it. */
export type CheckInLogRow = {
  id: string;
  registrationId: string;
  /** The event day in the event's time zone, "YYYY-MM-DD". */
  attendanceDate: string;
  checkedInAt: Date;
  method: EventCheckIn["method"];
  firstName: string;
  lastName: string;
  email: string;
  ticketCode: string;
  /** Null when nobody is recorded (self check-in later) or that user was deleted. */
  checkedByFirstName: string | null;
  checkedByLastName: string | null;
};

export type UpsertRegistrationResult =
  | { kind: "saved"; registration: EventRegistration }
  /** Another registration already has this code: the caller tries again with a new one. */
  | { kind: "ticket_code_taken" }
  /** The user's row is already `registered`, so nothing was changed. */
  | { kind: "already_registered" };

/** Upcoming = the event has not ended yet; past = it has. The same cut-off the events tabs use. */
function whenCondition(
  when: MyRegistrationListQuery["when"],
  now: Date,
): SQL | undefined {
  if (when === "upcoming") return gte(eventsTable.endAt, now);
  if (when === "past") return lt(eventsTable.endAt, now);
  return undefined;
}

/**
 * The attendee list's order: newest or oldest registration, by name, or the latest check-in first
 * (people who have not checked in come last). The id breaks ties.
 */
function attendeeOrder(
  sort: AttendeeListQuery["sort"],
  latest: LatestCheckIns,
): SQL[] {
  switch (sort) {
    case "checkedIn":
      return [
        sql`${latest.checkedInAt} desc nulls last`,
        desc(eventRegistrationsTable.id),
      ];
    case "oldest":
      return [
        asc(eventRegistrationsTable.registeredAt),
        asc(eventRegistrationsTable.id),
      ];
    case "name":
      return [
        asc(usersTable.lastName),
        asc(usersTable.firstName),
        asc(eventRegistrationsTable.id),
      ];
    case "newest":
      return [
        desc(eventRegistrationsTable.registeredAt),
        desc(eventRegistrationsTable.id),
      ];
  }
}

/** The order of a session's attendee list: newest or oldest seat first, or by name; the id breaks ties. */
function sessionAttendeeOrder(sort: AttendeeListQuery["sort"]): SQL[] {
  switch (sort) {
    case "checkedIn":
      return [
        sql`${sessionCheckInsTable.checkedInAt} desc nulls last`,
        desc(sessionRegistrationsTable.id),
      ];
    case "oldest":
      return [
        asc(sessionRegistrationsTable.registeredAt),
        asc(sessionRegistrationsTable.id),
      ];
    case "name":
      return [
        asc(usersTable.lastName),
        asc(usersTable.firstName),
        asc(sessionRegistrationsTable.id),
      ];
    case "newest":
      return [
        desc(sessionRegistrationsTable.registeredAt),
        desc(sessionRegistrationsTable.id),
      ];
  }
}

/**
 * One check-in per registration (the whole row, so the time, who did it and the method stay
 * together), built once so a list joins it instead of asking per row. A multi-day event has one
 * check-in per day: without `date` the latest one decides "has checked in"; with `date` ("YYYY-MM-DD",
 * the event day) only that day's counts, so a person who came on day 1 only is not checked in on
 * day 2. `distinct on` keeps the first row per registration of the order below: the latest.
 */
function latestCheckIns(date?: string) {
  return db
    .selectDistinctOn([eventCheckInsTable.registrationId], {
      registrationId: eventCheckInsTable.registrationId,
      checkedInAt: eventCheckInsTable.checkedInAt,
      checkedInBy: eventCheckInsTable.checkedInBy,
      method: eventCheckInsTable.method,
    })
    .from(eventCheckInsTable)
    .where(date ? eq(eventCheckInsTable.attendanceDate, date) : undefined)
    .orderBy(
      eventCheckInsTable.registrationId,
      desc(eventCheckInsTable.checkedInAt),
    )
    .as("latest_check_ins");
}
type LatestCheckIns = ReturnType<typeof latestCheckIns>;

/**
 * Every query of the registration feature. Rules live in the service; this only reads and
 * writes. The service owns the transaction (`transaction`) and passes `tx` to each method, so
 * the lock, the seat count and the insert are one unit.
 */
export const registrationRepository = {
  /** Runs `work` in one database transaction: it commits when `work` returns, rolls back if it throws. */
  transaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return db.transaction(work);
  },

  /**
   * The event row, locked until the transaction ends. "No key update" is enough: two
   * registrations for the same event wait for each other (so the seat count below cannot be
   * read by both at once), while an insert into a table that points at the event is not blocked.
   * It also holds off a cancel or a capacity edit of the same event.
   */
  async lockEvent(
    tx: DbTransaction,
    eventId: string,
  ): Promise<EventRecord | null> {
    const [event] = await tx
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .for("no key update");
    return event ?? null;
  },

  /** The user's registration for the event in any status, or null if they never registered. */
  async findRegistration(
    tx: DbTransaction,
    eventId: string,
    userId: string,
  ): Promise<EventRegistration | null> {
    const [registration] = await tx
      .select()
      .from(eventRegistrationsTable)
      .where(
        and(
          eq(eventRegistrationsTable.eventId, eventId),
          eq(eventRegistrationsTable.userId, userId),
        ),
      );
    return registration ?? null;
  },

  /**
   * The user's own registration for the event, in any status, with the event's price fields the
   * ticket needs. The user id is always the signed-in user's, never from the request, so this can
   * only ever return their own row. Null when they never registered; an unknown event id answers
   * the same, so it reveals nothing about which events exist.
   */
  async findOwnRegistration(
    eventId: string,
    userId: string,
  ): Promise<{
    registration: EventRegistration;
    event: Pick<EventRecord, "ticketPrice" | "currency">;
  } | null> {
    const [row] = await db
      .select({
        registration: eventRegistrationsTable,
        ticketPrice: eventsTable.ticketPrice,
        currency: eventsTable.currency,
      })
      .from(eventRegistrationsTable)
      .innerJoin(
        eventsTable,
        eq(eventsTable.id, eventRegistrationsTable.eventId),
      )
      .where(
        and(
          eq(eventRegistrationsTable.eventId, eventId),
          eq(eventRegistrationsTable.userId, userId),
        ),
      );
    if (!row) return null;
    return {
      registration: row.registration,
      event: { ticketPrice: row.ticketPrice, currency: row.currency },
    };
  },

  /** The sessions of this event the user holds a seat in (cancelled bookings do not count). */
  async findBookedSessionIds(
    eventId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ id: sessionRegistrationsTable.sessionId })
      .from(sessionRegistrationsTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, sessionRegistrationsTable.sessionId),
      )
      .where(
        and(
          eq(sessionsTable.eventId, eventId),
          eq(sessionRegistrationsTable.userId, userId),
          eq(sessionRegistrationsTable.status, "registered"),
        ),
      )
      .orderBy(asc(sessionRegistrationsTable.registeredAt));
    return rows.map((row) => row.id);
  },

  /**
   * One page of the user's registrations, each with its event, venue and the number of sessions
   * they hold a seat in. The user id is always the signed-in user's. The seat counts are grouped
   * once in a subquery and joined, so there is no query per ticket. `total` ignores paging but
   * follows the filters, and counts only this user's rows.
   */
  async listOwnRegistrations(params: {
    userId: string;
    status: MyRegistrationListQuery["status"];
    when: MyRegistrationListQuery["when"];
    now: Date;
    limit: number;
    offset: number;
  }): Promise<{ rows: MyRegistrationRow[]; total: number }> {
    // The user_id condition must stay: it runs BEFORE the grouping, so only this user's seats are
    // counted. Without it the count per event would include every attendee's seats.
    const bookedSeats = db
      .select({
        eventId: sessionsTable.eventId,
        n: sql<number>`count(*)::int`.as("booked_sessions"),
      })
      .from(sessionRegistrationsTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, sessionRegistrationsTable.sessionId),
      )
      .where(
        and(
          eq(sessionRegistrationsTable.userId, params.userId),
          eq(sessionRegistrationsTable.status, "registered"),
        ),
      )
      .groupBy(sessionsTable.eventId)
      .as("booked_seats");

    const where = and(
      eq(eventRegistrationsTable.userId, params.userId),
      params.status === "all"
        ? undefined
        : eq(eventRegistrationsTable.status, params.status),
      whenCondition(params.when, params.now),
    );
    // id breaks ties, so paging never shows a row twice or skips one.
    const orderBy =
      params.when === "upcoming"
        ? [asc(eventsTable.startAt), asc(eventRegistrationsTable.id)]
        : [desc(eventsTable.startAt), desc(eventRegistrationsTable.id)];

    const [rows, totals] = await Promise.all([
      db
        .select({
          registration: eventRegistrationsTable,
          event: {
            id: eventsTable.id,
            slug: eventsTable.slug,
            title: eventsTable.title,
            status: eventsTable.status,
            startAt: eventsTable.startAt,
            endAt: eventsTable.endAt,
            timezone: eventsTable.timezone,
            ticketPrice: eventsTable.ticketPrice,
            currency: eventsTable.currency,
            registrationClosesAt: eventsTable.registrationClosesAt,
          },
          venueName: venuesTable.name,
          venueCity: venuesTable.city,
          bookedSessionCount: sql<number>`coalesce(${bookedSeats.n}, 0)::int`,
        })
        .from(eventRegistrationsTable)
        .innerJoin(
          eventsTable,
          eq(eventsTable.id, eventRegistrationsTable.eventId),
        )
        .leftJoin(venuesTable, eq(venuesTable.id, eventsTable.venueId))
        .leftJoin(bookedSeats, eq(bookedSeats.eventId, eventsTable.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(params.limit)
        .offset(params.offset),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(eventRegistrationsTable)
        .innerJoin(
          eventsTable,
          eq(eventsTable.id, eventRegistrationsTable.eventId),
        )
        .where(where),
    ]);
    return { rows, total: totals[0]?.n ?? 0 };
  },

  /**
   * One page of the people registered for ONE event, newest registration first, with their name
   * and email and the latest check-in. The event id comes from the service after its ownership
   * check; nothing here decides who may look. The search text is a bound parameter, and % and _
   * in it are escaped so they search for themselves. `total` follows the filters, ignores paging.
   */
  async listAttendees(params: {
    eventId: string;
    status: AttendeeListQuery["status"];
    checkedIn: AttendeeListQuery["checkedIn"];
    /** One event day "YYYY-MM-DD": the check-in columns and filters then mean that day. */
    date?: string;
    sort: AttendeeListQuery["sort"];
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: AttendeeRow[]; total: number }> {
    const latest = latestCheckIns(params.date);
    // The person who did the check-in (a second join to users, next to the attendee's own).
    const checkedByUser = alias(usersTable, "checked_by_user");
    const pattern = params.search ? `%${escapeLike(params.search)}%` : null;

    const where = and(
      eq(eventRegistrationsTable.eventId, params.eventId),
      params.status === "all"
        ? undefined
        : eq(eventRegistrationsTable.status, params.status),
      params.checkedIn === "yes" ? isNotNull(latest.checkedInAt) : undefined,
      params.checkedIn === "no" ? isNull(latest.checkedInAt) : undefined,
      pattern
        ? or(
            ilike(usersTable.firstName, pattern),
            ilike(usersTable.lastName, pattern),
            // "Priya Shah" matches although the name is stored in two columns.
            ilike(
              sql`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
              pattern,
            ),
            ilike(usersTable.email, pattern),
            ilike(eventRegistrationsTable.ticketCode, pattern),
          )
        : undefined,
    );

    const [rows, totals] = await Promise.all([
      db
        .select({
          registrationId: eventRegistrationsTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
          ticketCode: eventRegistrationsTable.ticketCode,
          status: eventRegistrationsTable.status,
          registeredAt: eventRegistrationsTable.registeredAt,
          checkedInAt: latest.checkedInAt,
          checkedByFirstName: checkedByUser.firstName,
          checkedByLastName: checkedByUser.lastName,
          checkInMethod: latest.method,
        })
        .from(eventRegistrationsTable)
        .innerJoin(
          usersTable,
          eq(usersTable.id, eventRegistrationsTable.userId),
        )
        .leftJoin(latest, eq(latest.registrationId, eventRegistrationsTable.id))
        .leftJoin(checkedByUser, eq(checkedByUser.id, latest.checkedInBy))
        .where(where)
        // id breaks ties, so paging never shows a row twice or skips one.
        .orderBy(...attendeeOrder(params.sort, latest))
        .limit(params.limit)
        .offset(params.offset),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(eventRegistrationsTable)
        .innerJoin(
          usersTable,
          eq(usersTable.id, eventRegistrationsTable.userId),
        )
        .leftJoin(latest, eq(latest.registrationId, eventRegistrationsTable.id))
        .where(where),
    ]);
    return { rows, total: totals[0]?.n ?? 0 };
  },

  /**
   * How many registered, cancelled, checked-in and pending (registered, not checked in) people
   * the event has, whatever the search. With `date` ("YYYY-MM-DD") checked in and pending mean
   * that event day.
   */
  async countAttendees(
    eventId: string,
    date?: string,
  ): Promise<AttendeeCounts> {
    const latest = latestCheckIns(date);
    const [row] = await db
      .select({
        registered: sql<number>`(count(*) filter (where ${eventRegistrationsTable.status} = 'registered'))::int`,
        cancelled: sql<number>`(count(*) filter (where ${eventRegistrationsTable.status} = 'cancelled'))::int`,
        checkedIn: sql<number>`(count(*) filter (where ${eventRegistrationsTable.status} = 'registered' and ${latest.checkedInAt} is not null))::int`,
        pending: sql<number>`(count(*) filter (where ${eventRegistrationsTable.status} = 'registered' and ${latest.checkedInAt} is null))::int`,
      })
      .from(eventRegistrationsTable)
      .leftJoin(latest, eq(latest.registrationId, eventRegistrationsTable.id))
      .where(eq(eventRegistrationsTable.eventId, eventId));
    return {
      registered: row?.registered ?? 0,
      cancelled: row?.cancelled ?? 0,
      checkedIn: row?.checkedIn ?? 0,
      pending: row?.pending ?? 0,
    };
  },

  /** Is this session part of THIS event? (Read only, no lock: a list only needs to know it exists.) */
  async sessionExistsInEvent(
    eventId: string,
    sessionId: string,
  ): Promise<boolean> {
    const rows = await db
      .select({ one: sql<number>`1` })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.eventId, eventId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },

  /**
   * One page of the seats of one session, with the person, their ticket code of the event and the
   * session check-in (a seat has at most one, so the join cannot repeat a row). The ids come from
   * the service after its ownership check; nothing here decides who may look. The search text is
   * a bound parameter, and % and _ in it are escaped so they search for themselves. `total`
   * follows the search and the filters, ignores paging.
   */
  async listSessionAttendees(params: {
    eventId: string;
    sessionId: string;
    status: AttendeeListQuery["status"];
    checkedIn: AttendeeListQuery["checkedIn"];
    sort: AttendeeListQuery["sort"];
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: SessionAttendeeRow[]; total: number }> {
    const pattern = params.search ? `%${escapeLike(params.search)}%` : null;

    const where = and(
      eq(sessionRegistrationsTable.sessionId, params.sessionId),
      params.status === "all"
        ? undefined
        : eq(sessionRegistrationsTable.status, params.status),
      params.checkedIn === "yes"
        ? isNotNull(sessionCheckInsTable.id)
        : undefined,
      params.checkedIn === "no" ? isNull(sessionCheckInsTable.id) : undefined,
      pattern
        ? or(
            ilike(usersTable.firstName, pattern),
            ilike(usersTable.lastName, pattern),
            // "Priya Shah" matches although the name is stored in two columns.
            ilike(
              sql`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
              pattern,
            ),
            ilike(usersTable.email, pattern),
            ilike(eventRegistrationsTable.ticketCode, pattern),
          )
        : undefined,
    );

    const [rows, totals] = await Promise.all([
      db
        .select({
          bookingId: sessionRegistrationsTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
          ticketCode: eventRegistrationsTable.ticketCode,
          status: sessionRegistrationsTable.status,
          bookedAt: sessionRegistrationsTable.registeredAt,
          checkedInAt: sessionCheckInsTable.checkedInAt,
        })
        .from(sessionRegistrationsTable)
        .innerJoin(
          usersTable,
          eq(usersTable.id, sessionRegistrationsTable.userId),
        )
        // The person's ticket for THIS event: every seat needs one, so the join keeps every seat.
        .innerJoin(
          eventRegistrationsTable,
          and(
            eq(
              eventRegistrationsTable.userId,
              sessionRegistrationsTable.userId,
            ),
            eq(eventRegistrationsTable.eventId, params.eventId),
          ),
        )
        .leftJoin(
          sessionCheckInsTable,
          eq(
            sessionCheckInsTable.sessionRegistrationId,
            sessionRegistrationsTable.id,
          ),
        )
        .where(where)
        // id breaks ties, so paging never shows a row twice or skips one.
        .orderBy(...sessionAttendeeOrder(params.sort))
        .limit(params.limit)
        .offset(params.offset),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(sessionRegistrationsTable)
        .innerJoin(
          usersTable,
          eq(usersTable.id, sessionRegistrationsTable.userId),
        )
        .innerJoin(
          eventRegistrationsTable,
          and(
            eq(
              eventRegistrationsTable.userId,
              sessionRegistrationsTable.userId,
            ),
            eq(eventRegistrationsTable.eventId, params.eventId),
          ),
        )
        .leftJoin(
          sessionCheckInsTable,
          eq(
            sessionCheckInsTable.sessionRegistrationId,
            sessionRegistrationsTable.id,
          ),
        )
        .where(where),
    ]);
    return { rows, total: totals[0]?.n ?? 0 };
  },

  /**
   * The badges of one session, whatever the search. `checkedIn` counts the check-in rows, not the
   * seat status, so a session cancelled half-way (every seat cancelled) keeps its attendance;
   * `pending` is registered seats with no check-in yet.
   */
  async countSessionAttendees(
    sessionId: string,
  ): Promise<SessionAttendeeCounts> {
    const [row] = await db
      .select({
        registered: sql<number>`(count(*) filter (where ${sessionRegistrationsTable.status} = 'registered'))::int`,
        cancelled: sql<number>`(count(*) filter (where ${sessionRegistrationsTable.status} = 'cancelled'))::int`,
        checkedIn: sql<number>`(count(*) filter (where ${sessionCheckInsTable.id} is not null))::int`,
        pending: sql<number>`(count(*) filter (where ${sessionRegistrationsTable.status} = 'registered' and ${sessionCheckInsTable.id} is null))::int`,
      })
      .from(sessionRegistrationsTable)
      .leftJoin(
        sessionCheckInsTable,
        eq(
          sessionCheckInsTable.sessionRegistrationId,
          sessionRegistrationsTable.id,
        ),
      )
      .where(eq(sessionRegistrationsTable.sessionId, sessionId));
    return {
      registered: row?.registered ?? 0,
      cancelled: row?.cancelled ?? 0,
      checkedIn: row?.checkedIn ?? 0,
      pending: row?.pending ?? 0,
    };
  },

  /**
   * One page of the event's check-ins, one row per check-in (a person checked in on two days has
   * two rows), with the person and who checked them in. The event id comes from the service after
   * its ownership check; nothing here decides who may look. The search text is a bound parameter,
   * and % and _ in it are escaped so they search for themselves. `total` follows the search and
   * the day, ignores paging.
   */
  async listCheckIns(params: {
    eventId: string;
    sort: CheckInListQuery["sort"];
    /** One event day, "YYYY-MM-DD"; undefined = every day. */
    date?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: CheckInLogRow[]; total: number }> {
    // Two joins to users: the person who was checked in, and the person who did it.
    const checkedByUser = alias(usersTable, "checked_by_user");
    const pattern = params.search ? `%${escapeLike(params.search)}%` : null;

    const where = and(
      eq(eventRegistrationsTable.eventId, params.eventId),
      params.date
        ? eq(eventCheckInsTable.attendanceDate, params.date)
        : undefined,
      pattern
        ? or(
            ilike(usersTable.firstName, pattern),
            ilike(usersTable.lastName, pattern),
            // "Priya Shah" matches although the name is stored in two columns.
            ilike(
              sql`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
              pattern,
            ),
            ilike(usersTable.email, pattern),
            ilike(eventRegistrationsTable.ticketCode, pattern),
          )
        : undefined,
    );
    // id breaks ties, so paging never shows a row twice or skips one.
    const orderBy =
      params.sort === "oldest"
        ? [asc(eventCheckInsTable.checkedInAt), asc(eventCheckInsTable.id)]
        : params.sort === "name"
          ? [
              asc(usersTable.lastName),
              asc(usersTable.firstName),
              asc(eventCheckInsTable.checkedInAt),
              asc(eventCheckInsTable.id),
            ]
          : [desc(eventCheckInsTable.checkedInAt), desc(eventCheckInsTable.id)];

    const [rows, totals] = await Promise.all([
      db
        .select({
          id: eventCheckInsTable.id,
          registrationId: eventCheckInsTable.registrationId,
          attendanceDate: eventCheckInsTable.attendanceDate,
          checkedInAt: eventCheckInsTable.checkedInAt,
          method: eventCheckInsTable.method,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email,
          ticketCode: eventRegistrationsTable.ticketCode,
          checkedByFirstName: checkedByUser.firstName,
          checkedByLastName: checkedByUser.lastName,
        })
        .from(eventCheckInsTable)
        .innerJoin(
          eventRegistrationsTable,
          eq(eventRegistrationsTable.id, eventCheckInsTable.registrationId),
        )
        .innerJoin(
          usersTable,
          eq(usersTable.id, eventRegistrationsTable.userId),
        )
        .leftJoin(
          checkedByUser,
          eq(checkedByUser.id, eventCheckInsTable.checkedInBy),
        )
        .where(where)
        .orderBy(...orderBy)
        .limit(params.limit)
        .offset(params.offset),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(eventCheckInsTable)
        .innerJoin(
          eventRegistrationsTable,
          eq(eventRegistrationsTable.id, eventCheckInsTable.registrationId),
        )
        .innerJoin(
          usersTable,
          eq(usersTable.id, eventRegistrationsTable.userId),
        )
        .where(where),
    ]);
    return { rows, total: totals[0]?.n ?? 0 };
  },

  /**
   * Seats taken for the event right now: the registrations that hold a seat. Only `registered`
   * does today; when paid tickets arrive, a seat held while the person is paying counts too, and
   * this is the one place to change.
   */
  async countSeatsTaken(tx: DbTransaction, eventId: string): Promise<number> {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(eventRegistrationsTable)
      .where(
        and(
          eq(eventRegistrationsTable.eventId, eventId),
          eq(eventRegistrationsTable.status, "registered"),
        ),
      );
    return row?.n ?? 0;
  },

  /** Is the user on a session of this event that is not cancelled (speaker, moderator or host)? */
  async isSpeakerOfEvent(
    tx: DbTransaction,
    userId: string,
    eventId: string,
  ): Promise<boolean> {
    const rows = await tx
      .select({ one: sql<number>`1` })
      .from(sessionSpeakersTable)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, sessionSpeakersTable.sessionId),
      )
      .innerJoin(
        speakersProfilesTable,
        eq(speakersProfilesTable.id, sessionSpeakersTable.speakerId),
      )
      .where(
        and(
          eq(speakersProfilesTable.userId, userId),
          eq(sessionsTable.eventId, eventId),
          ne(sessionsTable.status, "cancelled"),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },

  /**
   * The session of THIS event, with its hall's capacity, locked until the transaction ends. The
   * event id is part of the lookup, so a session of another event is "not found". The lock is on
   * the session row only (`of`), so a session cancel or move waits for a booking in progress and
   * the other way round. A session with no hall (online) answers a null capacity (left join).
   */
  async findSessionForBooking(
    tx: DbTransaction,
    eventId: string,
    sessionId: string,
  ): Promise<SessionForBooking | null> {
    const [row] = await tx
      .select({
        id: sessionsTable.id,
        eventId: sessionsTable.eventId,
        status: sessionsTable.status,
        mode: sessionsTable.mode,
        startAt: sessionsTable.startAt,
        endAt: sessionsTable.endAt,
        requiresRegistration: sessionsTable.requiresRegistration,
        price: sessionsTable.price,
        hallCapacity: hallsTable.capacity,
      })
      .from(sessionsTable)
      .leftJoin(hallsTable, eq(hallsTable.id, sessionsTable.hallId))
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.eventId, eventId),
        ),
      )
      .for("no key update", { of: sessionsTable });
    return row ?? null;
  },

  /** The user's booking for the session in any status, or null if they never booked it. */
  async findSessionBooking(
    tx: DbTransaction,
    sessionId: string,
    userId: string,
  ): Promise<SessionRegistration | null> {
    const [booking] = await tx
      .select()
      .from(sessionRegistrationsTable)
      .where(
        and(
          eq(sessionRegistrationsTable.sessionId, sessionId),
          eq(sessionRegistrationsTable.userId, userId),
        ),
      );
    return booking ?? null;
  },

  /** Is the user a speaker, moderator or host of THIS session? (Speaking in another one does not count.) */
  async isSpeakerOfSession(
    tx: DbTransaction,
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const rows = await tx
      .select({ one: sql<number>`1` })
      .from(sessionSpeakersTable)
      .innerJoin(
        speakersProfilesTable,
        eq(speakersProfilesTable.id, sessionSpeakersTable.speakerId),
      )
      .where(
        and(
          eq(sessionSpeakersTable.sessionId, sessionId),
          eq(speakersProfilesTable.userId, userId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },

  /** How many seats of the session are held right now (cancelled bookings free their seat). */
  async countSessionSeatsTaken(
    tx: DbTransaction,
    sessionId: string,
  ): Promise<number> {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(sessionRegistrationsTable)
      .where(
        and(
          eq(sessionRegistrationsTable.sessionId, sessionId),
          eq(sessionRegistrationsTable.status, "registered"),
        ),
      );
    return row?.n ?? 0;
  },

  /**
   * Books the seat, or flips the user's CANCELLED booking back to registered (fresh
   * `registered_at`, `cancelled_at` cleared). A booking that is already `registered` is left
   * alone and the answer is null: the caller says "already booked". The time comes from the
   * caller so the service and its tests share one clock.
   */
  async upsertSessionBooking(
    tx: DbTransaction,
    input: { sessionId: string; userId: string; at: Date },
  ): Promise<SessionRegistration | null> {
    const [booking] = await tx
      .insert(sessionRegistrationsTable)
      .values({
        sessionId: input.sessionId,
        userId: input.userId,
        status: "registered",
        registeredAt: input.at,
      })
      .onConflictDoUpdate({
        target: [
          sessionRegistrationsTable.sessionId,
          sessionRegistrationsTable.userId,
        ],
        set: {
          status: "registered",
          registeredAt: input.at,
          cancelledAt: null,
          updatedAt: input.at,
        },
        // Only a cancelled booking is revived; a registered one makes the update match nothing.
        setWhere: eq(sessionRegistrationsTable.status, "cancelled"),
      })
      .returning();
    return booking ?? null;
  },

  /**
   * Creates the registration, or flips the user's CANCELLED one back to registered. The table
   * allows one row per person per event, so the same row is reused: a fresh `registered_at`,
   * `cancelled_at` cleared and a new ticket code, so the old ticket stops working. A row that is
   * already `registered` is left alone.
   *
   * The insert runs in a savepoint: a code collision aborts only the savepoint, so the caller's
   * transaction is still alive and can try again with another code.
   */
  async upsertRegistration(
    tx: DbTransaction,
    input: { eventId: string; userId: string; ticketCode: string; at: Date },
  ): Promise<UpsertRegistrationResult> {
    try {
      const rows = await tx.transaction((savepoint) =>
        savepoint
          .insert(eventRegistrationsTable)
          .values({
            eventId: input.eventId,
            userId: input.userId,
            status: "registered",
            ticketCode: input.ticketCode,
            registeredAt: input.at,
          })
          .onConflictDoUpdate({
            target: [
              eventRegistrationsTable.eventId,
              eventRegistrationsTable.userId,
            ],
            set: {
              status: "registered",
              ticketCode: input.ticketCode,
              registeredAt: input.at,
              cancelledAt: null,
              updatedAt: input.at,
            },
            // Only a cancelled row is revived; a registered one makes the update match nothing.
            setWhere: eq(eventRegistrationsTable.status, "cancelled"),
          })
          .returning(),
      );
      const [registration] = rows;
      return registration
        ? { kind: "saved", registration }
        : { kind: "already_registered" };
    } catch (error) {
      if (isTicketCodeCollision(error)) return { kind: "ticket_code_taken" };
      throw error;
    }
  },

  /**
   * The registration of THIS event that holds the ticket code, with its person's name, in any
   * status. The event id is part of the lookup, so a code of another event is "not found".
   */
  async findRegistrationByTicketCode(
    tx: DbTransaction,
    eventId: string,
    ticketCode: string,
  ): Promise<{
    registration: EventRegistration;
    firstName: string;
    lastName: string;
  } | null> {
    const [row] = await tx
      .select({
        registration: eventRegistrationsTable,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(eventRegistrationsTable)
      .innerJoin(usersTable, eq(usersTable.id, eventRegistrationsTable.userId))
      .where(
        and(
          eq(eventRegistrationsTable.eventId, eventId),
          eq(eventRegistrationsTable.ticketCode, ticketCode),
        ),
      );
    return row ?? null;
  },

  /**
   * Writes the manual check-in. The table allows one check-in per registration per day, so a
   * second one for the same day inserts nothing and answers null: the caller says "already
   * checked in". The time comes from the caller so the service and its tests share one clock.
   */
  async insertEventCheckIn(
    tx: DbTransaction,
    input: {
      registrationId: string;
      /** The event day in the event's time zone, "YYYY-MM-DD". */
      attendanceDate: string;
      checkedInBy: string;
      at: Date;
    },
  ): Promise<EventCheckIn | null> {
    const [checkIn] = await tx
      .insert(eventCheckInsTable)
      .values({
        registrationId: input.registrationId,
        attendanceDate: input.attendanceDate,
        checkedInAt: input.at,
        checkedInBy: input.checkedInBy,
        method: "manual",
      })
      .onConflictDoNothing({
        target: [
          eventCheckInsTable.registrationId,
          eventCheckInsTable.attendanceDate,
        ],
      })
      .returning();
    return checkIn ?? null;
  },

  /** The registration's event check-in for one event day ("YYYY-MM-DD"), or null if none. */
  async findEventCheckIn(
    tx: DbTransaction,
    registrationId: string,
    attendanceDate: string,
  ): Promise<EventCheckIn | null> {
    const [checkIn] = await tx
      .select()
      .from(eventCheckInsTable)
      .where(
        and(
          eq(eventCheckInsTable.registrationId, registrationId),
          eq(eventCheckInsTable.attendanceDate, attendanceDate),
        ),
      );
    return checkIn ?? null;
  },

  /**
   * Writes the manual session check-in. The table allows one check-in per seat, so a second one
   * inserts nothing and answers null: the caller says "already checked in". The time comes from
   * the caller so the service and its tests share one clock.
   */
  async insertSessionCheckIn(
    tx: DbTransaction,
    input: {
      sessionRegistrationId: string;
      /** The event check-in of the same day that this one builds on. */
      eventCheckInId: string;
      checkedInBy: string;
      at: Date;
    },
  ): Promise<SessionCheckIn | null> {
    const [checkIn] = await tx
      .insert(sessionCheckInsTable)
      .values({
        sessionRegistrationId: input.sessionRegistrationId,
        eventCheckInId: input.eventCheckInId,
        checkedInAt: input.at,
        checkedInBy: input.checkedInBy,
        method: "manual",
      })
      .onConflictDoNothing({
        target: [sessionCheckInsTable.sessionRegistrationId],
      })
      .returning();
    return checkIn ?? null;
  },

  /** The seat's session check-in, or null if it has not been used. */
  async findSessionCheckIn(
    tx: DbTransaction,
    sessionRegistrationId: string,
  ): Promise<SessionCheckIn | null> {
    const [checkIn] = await tx
      .select()
      .from(sessionCheckInsTable)
      .where(
        eq(sessionCheckInsTable.sessionRegistrationId, sessionRegistrationId),
      );
    return checkIn ?? null;
  },

  /** Has this registration ever been used to check in? (The check-in rows are written later.) */
  async hasCheckIn(
    tx: DbTransaction,
    registrationId: string,
  ): Promise<boolean> {
    const rows = await tx
      .select({ one: sql<number>`1` })
      .from(eventCheckInsTable)
      .where(eq(eventCheckInsTable.registrationId, registrationId))
      .limit(1);
    return rows.length > 0;
  },

  /**
   * Flips a `registered` registration to cancelled, in one UPDATE. The status is part of the
   * WHERE, so only a registered row changes: null = it was not registered any more. The ticket
   * code stays on the row (it no longer works; registering again replaces it).
   */
  async cancelRegistration(
    tx: DbTransaction,
    registrationId: string,
    at: Date,
  ): Promise<EventRegistration | null> {
    const [registration] = await tx
      .update(eventRegistrationsTable)
      .set({ status: "cancelled", cancelledAt: at, updatedAt: at })
      .where(
        and(
          eq(eventRegistrationsTable.id, registrationId),
          eq(eventRegistrationsTable.status, "registered"),
        ),
      )
      .returning();
    return registration ?? null;
  },

  /** Has this seat been used to check in to the session? */
  async hasSessionCheckIn(
    tx: DbTransaction,
    sessionRegistrationId: string,
  ): Promise<boolean> {
    const rows = await tx
      .select({ one: sql<number>`1` })
      .from(sessionCheckInsTable)
      .where(
        eq(sessionCheckInsTable.sessionRegistrationId, sessionRegistrationId),
      )
      .limit(1);
    return rows.length > 0;
  },

  /**
   * Flips a `registered` seat to cancelled, in one UPDATE. The status is part of the WHERE, so
   * only a registered row changes: null = it was not registered any more. The seat is free at
   * once, because the seat count only counts `registered` rows.
   */
  async cancelSessionBooking(
    tx: DbTransaction,
    bookingId: string,
    at: Date,
  ): Promise<SessionRegistration | null> {
    const [booking] = await tx
      .update(sessionRegistrationsTable)
      .set({ status: "cancelled", cancelledAt: at, updatedAt: at })
      .where(
        and(
          eq(sessionRegistrationsTable.id, bookingId),
          eq(sessionRegistrationsTable.status, "registered"),
        ),
      )
      .returning();
    return booking ?? null;
  },

  /**
   * Cancels every seat the user holds in the sessions of this event, so a cancelled registration
   * never leaves a booking behind. Returns how many seats were freed.
   */
  async cancelSessionBookings(
    tx: DbTransaction,
    eventId: string,
    userId: string,
    at: Date,
  ): Promise<number> {
    const cancelled = await tx
      .update(sessionRegistrationsTable)
      .set({ status: "cancelled", cancelledAt: at, updatedAt: at })
      .where(
        and(
          eq(sessionRegistrationsTable.userId, userId),
          eq(sessionRegistrationsTable.status, "registered"),
          inArray(
            sessionRegistrationsTable.sessionId,
            tx
              .select({ id: sessionsTable.id })
              .from(sessionsTable)
              .where(eq(sessionsTable.eventId, eventId)),
          ),
        ),
      )
      .returning({ id: sessionRegistrationsTable.id });
    return cancelled.length;
  },
};

export type RegistrationRepository = typeof registrationRepository;
