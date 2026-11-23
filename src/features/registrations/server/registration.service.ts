import "server-only";
import { env } from "../../../config/env";
import { PERMISSION } from "../../../core/auth/permission-catalog";
import type { CurrentUser } from "../../../core/auth/server/auth-session";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import type { EventRecord } from "../../../db/schemas";
import {
  eventAccess,
  type EventAccess,
  type EventActor,
} from "../../events/server";
import type {
  AttendeeCounts,
  AttendeeDto,
  AttendeeListQuery,
  SessionAttendeeCounts,
  SessionAttendeeDto,
} from "../schemas/attendees.schemas";
import type {
  CheckInBody,
  CheckInCounts,
  EventCheckInBody,
  CheckInDto,
  CheckInListQuery,
  CheckInLogItemDto,
  SessionCheckInDto,
} from "../schemas/check-ins.schemas";
import type {
  MyRegistrationDto,
  MyRegistrationListQuery,
  MyTicketDto,
  RegistrationDto,
  SessionBookingDto,
} from "../schemas/registrations.schemas";
import {
  alreadyCheckedInDetails,
  heldTicketPrice,
  toAttendeeDto,
  toSessionAttendeeDto,
  toCheckInDto,
  toCheckInLogItemDto,
  toMyTicketDto,
  toRegistrationDto,
  toSessionBookingDto,
  toSessionCheckInDto,
  type RegistrationPrice,
} from "./registration.dto";
import {
  registrationRepository,
  type DbTransaction,
  type RegistrationRepository,
  type SessionForBooking,
} from "./registration.repository";
import { dayCheckInWindow, eventDayOf } from "../utils/attendance-day";
import { generateTicketCode } from "./ticket-code";

/** Who is asking: the signed-in user from the access token. */
export type RegistrationActor = Pick<CurrentUser, "id">;

export type RegistrationServiceDeps = {
  registrationRepository: RegistrationRepository;
  /** Who may touch which event (the same rule the events feature uses). */
  eventAccess: Pick<EventAccess, "getEventIfOrgOwns">;
  now?: () => Date;
  newTicketCode?: () => string;
  /** How many hours before the start check-in opens. Default 6. */
  checkInOpensHoursBefore?: number;
  /** How many hours before a session starts its check-in opens. Default 2. */
  sessionCheckInOpensHoursBefore?: number;
};

/** The one answer to registering twice: it names the rule, so the page can say it plainly. */
const alreadyRegistered = () =>
  new ConflictError(
    "ALREADY_REGISTERED",
    "You are already registered for this event",
  );

/** The one answer to booking a seat twice: it names the rule, so the page can say it plainly. */
const alreadyBooked = () =>
  new ConflictError("ALREADY_BOOKED", "You have already booked a seat here");

/** What a ticket would cost this user. "paid" is known but cannot be sold yet. */
type TicketPrice =
  RegistrationPrice | { amount: number; currency: string; reason: "paid" };

// A clash of two random codes is about one in a billion; three tries is far more than enough.
const MAX_TICKET_CODE_ATTEMPTS = 3;

// The door opens this long before the event starts (people arrive early) and shuts when it ends.
// The real value is the CHECK_IN_OPENS_HOURS_BEFORE setting (6 in production); this is the
// default when a service is built without one.
const DEFAULT_CHECK_IN_OPENS_HOURS_BEFORE = 6;
// A session's door opens this long before the session starts (a big session needs time to let
// everyone in) and shuts when it ends. The real value is SESSION_CHECK_IN_OPENS_HOURS_BEFORE.
const DEFAULT_SESSION_CHECK_IN_OPENS_HOURS_BEFORE = 2;
const HOUR_MS = 60 * 60 * 1000;

/**
 * An attendee's event registration. For now only free tickets: a speaker of the event gets a
 * complimentary one, everyone else pays the event's ticket price, and a price above 0 is refused
 * until Stripe is added (the one place to change is `register`, where the price is decided).
 */
export function createRegistrationService(deps: RegistrationServiceDeps) {
  const repo = deps.registrationRepository;
  const now = deps.now ?? (() => new Date());
  const newTicketCode = deps.newTicketCode ?? generateTicketCode;
  const checkInOpensHoursBefore =
    deps.checkInOpensHoursBefore ?? DEFAULT_CHECK_IN_OPENS_HOURS_BEFORE;
  const sessionCheckInOpensHoursBefore =
    deps.sessionCheckInOpensHoursBefore ??
    DEFAULT_SESSION_CHECK_IN_OPENS_HOURS_BEFORE;

  /**
   * The ONE place that decides what a ticket costs. A free event is free for everyone; on a paid
   * event the people who speak there get in for nothing and everybody else pays the price.
   */
  async function priceFor(
    tx: DbTransaction,
    event: EventRecord,
    userId: string,
  ): Promise<TicketPrice> {
    const { currency } = event;
    if (event.ticketPrice === 0) return { amount: 0, currency, reason: "free" };
    if (await repo.isSpeakerOfEvent(tx, userId, event.id)) {
      return { amount: 0, currency, reason: "complimentary_speaker" };
    }
    return { amount: event.ticketPrice, currency, reason: "paid" };
  }

  /** The event must be published, not over, and inside its registration window. */
  function assertOpenForRegistration(event: EventRecord, at: Date): void {
    // A draft is not public yet, so it is "not found", not "closed".
    if (event.status === "draft") throw new NotFoundError("Event not found");
    if (event.status === "cancelled") {
      throw new ConflictError("EVENT_CANCELLED", "This event was cancelled");
    }
    if (event.endAt <= at) {
      throw new ConflictError("EVENT_ENDED", "This event is over");
    }
    if (event.registrationOpensAt && at < event.registrationOpensAt) {
      throw new ConflictError(
        "REGISTRATION_NOT_OPEN",
        "Registration has not opened yet",
      );
    }
    // No closing time set means registration closes when the event starts.
    const closesAt = event.registrationClosesAt ?? event.startAt;
    if (at >= closesAt) {
      throw new ConflictError("REGISTRATION_CLOSED", "Registration is closed");
    }
  }

  /** A check-in, of the event or of a session, needs a published event that was not cancelled. */
  function assertEventPublished(event: EventRecord): void {
    if (event.status === "draft") {
      throw new ConflictError(
        "EVENT_NOT_PUBLISHED",
        "This event is not published yet",
      );
    }
    if (event.status === "cancelled") {
      throw new ConflictError("EVENT_CANCELLED", "This event was cancelled");
    }
  }

  /**
   * The session must be scheduled, and now must be inside its check-in window: from
   * `sessionCheckInOpensHoursBefore` before it starts until it ends. Returns its start, which a
   * scheduled session always has.
   */
  function assertSessionCheckInOpen(
    session: SessionForBooking,
    at: Date,
  ): Date {
    // A draft is not on the schedule, so it is "not found", not "closed".
    if (session.status === "draft") {
      throw new NotFoundError("Session not found");
    }
    if (session.status === "cancelled") {
      throw new ConflictError(
        "SESSION_CANCELLED",
        "This session was cancelled",
      );
    }
    // A scheduled session always has a time (a table check), so null is only a type guard.
    if (!session.startAt || !session.endAt) {
      throw new ConflictError(
        "CHECK_IN_NOT_OPEN",
        "This session has no time yet",
      );
    }
    if (at >= session.endAt) {
      throw new ConflictError(
        "CHECK_IN_CLOSED",
        "Check-in is closed: this session is over",
      );
    }
    if (
      at.getTime() <
      session.startAt.getTime() - sessionCheckInOpensHoursBefore * HOUR_MS
    ) {
      throw new ConflictError(
        "CHECK_IN_NOT_OPEN",
        `Session check-in opens ${sessionCheckInOpensHoursBefore} ${
          sessionCheckInOpensHoursBefore === 1 ? "hour" : "hours"
        } before the session starts`,
      );
    }
    return session.startAt;
  }

  /**
   * The event must be published and not cancelled, `date` must be one of its days, and now must be
   * inside THAT day's check-in window: from `checkInOpensHoursBefore` before the day's start (6 in
   * production, a year in dev) until that day's hours end, the event's end for the last day (see
   * dayCheckInWindow). So a late arrival is accepted while the day is still running, and a past
   * day is always refused.
   */
  function assertCheckInOpenFor(
    event: EventRecord,
    date: string,
    at: Date,
  ): void {
    assertEventPublished(event);
    if (at >= event.endAt) {
      throw new ConflictError(
        "CHECK_IN_CLOSED",
        "Check-in is closed: this event is over",
      );
    }
    const window = dayCheckInWindow(date, event, checkInOpensHoursBefore);
    if (!window) {
      throw new ConflictError(
        "NOT_AN_EVENT_DAY",
        `${date} is not a day of this event`,
      );
    }
    if (at < window.opensAt) {
      throw new ConflictError(
        "CHECK_IN_NOT_OPEN",
        `Check-in for ${date} opens ${checkInOpensHoursBefore} ${
          checkInOpensHoursBefore === 1 ? "hour" : "hours"
        } before that day starts`,
      );
    }
    if (at >= window.closesAt) {
      throw new ConflictError(
        "CHECK_IN_CLOSED",
        `Check-in for ${date} is over`,
      );
    }
  }

  return {
    /**
     * The signed-in user's own standing in one event: their registration (or null if they never
     * registered; a cancelled one comes back as cancelled) and the sessions they hold a seat in.
     * It only ever reads rows of `actor.id`, so nobody sees someone else's ticket, and an event
     * that does not exist answers the same as one they never registered for. It reads whatever the
     * event's state, so a ticket stays visible after the event is cancelled or over.
     */
    async getMyRegistration(
      eventId: string,
      actor: RegistrationActor,
    ): Promise<MyRegistrationDto> {
      const found = await repo.findOwnRegistration(eventId, actor.id);
      if (!found) return { registration: null, bookedSessionIds: [] };

      // A cancelled registration took its session bookings with it, so there is nothing to look up.
      const bookedSessionIds =
        found.registration.status === "registered"
          ? await repo.findBookedSessionIds(eventId, actor.id)
          : [];
      return {
        registration: toRegistrationDto(
          found.registration,
          heldTicketPrice(found.event),
        ),
        bookedSessionIds,
      };
    },

    /**
     * One page of every event the signed-in user registered for ("My tickets"), cancelled ones
     * included unless filtered out. It only ever reads rows of `actor.id`, whatever the query
     * says (the query has no user field), and it reads whatever the event's state, so a ticket
     * stays listed after the event is cancelled or over.
     */
    async listMyRegistrations(
      query: MyRegistrationListQuery,
      actor: RegistrationActor,
    ): Promise<{ items: MyTicketDto[]; meta: PageMeta }> {
      const { page, pageSize, status, when } = query;
      const { rows, total } = await repo.listOwnRegistrations({
        userId: actor.id,
        status,
        when,
        now: now(),
        // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return {
        items: rows.map(toMyTicketDto),
        meta: { page, pageSize, total },
      };
    },

    /**
     * The people registered for one event, one page, for the organizer's Attendees tab. Two
     * checks, in this order: the role must grant REGISTRATION_VIEW_EVENT (organizer) or
     * REGISTRATION_VIEW_ALL (admin), then the event must be reachable: an organizer reaches only
     * their own events and someone else's is a 404 (never a 403), an admin any event, and an
     * unapproved organizer none. The email is personal data: it leaves only through this check.
     * The counts cover the whole event, not the search, so the tab badges stay put while typing.
     */
    async listAttendees(
      eventId: string,
      query: AttendeeListQuery,
      actor: EventActor,
    ): Promise<{
      items: AttendeeDto[];
      meta: PageMeta & {
        counts: AttendeeCounts;
        checkInOpensHoursBefore: number;
      };
    }> {
      if (
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_ALL) &&
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_EVENT)
      ) {
        throw new ForbiddenError();
      }
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      const { page, pageSize, status, checkedIn, date, sort, search } = query;
      const [{ rows, total }, counts] = await Promise.all([
        repo.listAttendees({
          eventId,
          status,
          checkedIn,
          date,
          sort,
          // An empty search (after trim) counts as no search.
          search: search || undefined,
          // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        // The badges follow the asked day too, so "pending on day 2" and its count agree.
        repo.countAttendees(eventId, date),
      ]);
      return {
        items: rows.map(toAttendeeDto),
        // The setting, so the door screen can tell which days are open (same rule, same number).
        meta: { page, pageSize, total, counts, checkInOpensHoursBefore },
      };
    },

    /**
     * The seats of one session, one page, with who checked in (`checkedIn=no` is the pending
     * list: booked, not yet at the door of the session). The same two checks as the event
     * attendee list, in the same order: the role must grant REGISTRATION_VIEW_EVENT (organizer)
     * or REGISTRATION_VIEW_ALL (admin), then the event must be reachable (an organizer's own,
     * else a 404; an admin any event). Then the session must be in THIS event, or it is a 404.
     * Names and emails leave only through these checks. The counts cover the whole session, not
     * the search or the filters.
     */
    async listSessionAttendees(
      eventId: string,
      sessionId: string,
      query: AttendeeListQuery,
      actor: EventActor,
    ): Promise<{
      items: SessionAttendeeDto[];
      meta: PageMeta & {
        counts: SessionAttendeeCounts;
        checkInOpensHoursBefore: number;
      };
    }> {
      if (
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_ALL) &&
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_EVENT)
      ) {
        throw new ForbiddenError();
      }
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      if (!(await repo.sessionExistsInEvent(eventId, sessionId))) {
        throw new NotFoundError("Session not found");
      }

      const { page, pageSize, status, checkedIn, sort, search } = query;
      const [{ rows, total }, counts] = await Promise.all([
        repo.listSessionAttendees({
          eventId,
          sessionId,
          status,
          checkedIn,
          sort,
          // An empty search (after trim) counts as no search.
          search: search || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        repo.countSessionAttendees(sessionId),
      ]);
      return {
        items: rows.map(toSessionAttendeeDto),
        meta: {
          page,
          pageSize,
          total,
          counts,
          checkInOpensHoursBefore: sessionCheckInOpensHoursBefore,
        },
      };
    },

    /**
     * The check-in log of one event, one page: one row per check-in, newest first unless asked
     * otherwise, searchable and filterable by event day. The same two checks as the attendee list,
     * in the same order: the role must grant REGISTRATION_VIEW_EVENT (organizer) or
     * REGISTRATION_VIEW_ALL (admin), then the event must be reachable (an organizer's own, else a
     * 404; an admin any event; an unapproved organizer none). Names and emails leave only through
     * this check. The counts cover the whole event, not the search or the day.
     */
    async listCheckIns(
      eventId: string,
      query: CheckInListQuery,
      actor: EventActor,
    ): Promise<{
      items: CheckInLogItemDto[];
      meta: PageMeta & { counts: CheckInCounts };
    }> {
      if (
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_ALL) &&
        !actor.permissions.has(PERMISSION.REGISTRATION_VIEW_EVENT)
      ) {
        throw new ForbiddenError();
      }
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      const { page, pageSize, search, date, sort } = query;
      const [{ rows, total }, counts] = await Promise.all([
        repo.listCheckIns({
          eventId,
          sort,
          date,
          // An empty search (after trim) counts as no search.
          search: search || undefined,
          // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        repo.countAttendees(eventId),
      ]);
      return {
        items: rows.map(toCheckInLogItemDto),
        meta: {
          page,
          pageSize,
          total,
          // People, not check-ins: the same figure the attendee list's tab badge shows.
          counts: {
            checkedIn: counts.checkedIn,
            registered: counts.registered,
          },
        },
      };
    },

    /**
     * Checks a person in at the door by their ticket code (manual; a QR scan will send the same
     * code later). Checks in this order: the role may check in (REGISTRATION_CHECKIN_EVENT for an
     * organizer, REGISTRATION_CHECKIN_ALL for an admin), the event is reachable (an organizer's
     * own, otherwise 404), then in ONE transaction that first locks the event row, as register and
     * cancel do, so a check-in and a cancel of the same ticket take turns and cannot both win:
     * the event is published, not cancelled and inside the check-in window, the code belongs to a
     * ticket of THIS event (another event's code is a 404), the ticket is still registered, and
     * the person has not been checked in for this event day. The door sends the day
     * (`attendanceDate`); it must be a day of the event whose window is open now
     * (`assertCheckInOpenFor`), so a multi-day event checks a person in once per event day and
     * every check-in lands on a day of the event.
     */
    async checkInAttendee(
      eventId: string,
      body: EventCheckInBody,
      actor: EventActor,
    ): Promise<CheckInDto> {
      if (
        !actor.permissions.has(PERMISSION.REGISTRATION_CHECKIN_ALL) &&
        !actor.permissions.has(PERMISSION.REGISTRATION_CHECKIN_EVENT)
      ) {
        throw new ForbiddenError();
      }
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      const at = now();
      return repo.transaction(async (tx) => {
        const event = await repo.lockEvent(tx, eventId);
        if (!event) throw new NotFoundError("Event not found");
        assertCheckInOpenFor(event, body.attendanceDate, at);

        const found = await repo.findRegistrationByTicketCode(
          tx,
          eventId,
          body.ticketCode,
        );
        if (!found) throw new NotFoundError("Ticket not found");
        if (found.registration.status !== "registered") {
          throw new ConflictError(
            "REGISTRATION_CANCELLED",
            "This ticket was cancelled",
          );
        }

        const checkIn = await repo.insertEventCheckIn(tx, {
          registrationId: found.registration.id,
          // The day the door picked, checked above: one of the event's days, open right now.
          attendanceDate: body.attendanceDate,
          checkedInBy: actor.id,
          at,
        });
        const person = {
          firstName: found.firstName,
          lastName: found.lastName,
          ticketCode: found.registration.ticketCode,
        };
        if (!checkIn) {
          // Say who it is and since when, so the door can tell the person apart from a mistake.
          const first = await repo.findEventCheckIn(
            tx,
            found.registration.id,
            body.attendanceDate,
          );
          throw new ConflictError(
            "ALREADY_CHECKED_IN",
            `${found.firstName} ${found.lastName} is already checked in today`,
            first ? alreadyCheckedInDetails(person, first.checkedInAt) : {},
          );
        }
        return toCheckInDto(checkIn, person);
      });
    },

    /**
     * Checks a booked person in at the door of ONE session by their ticket code (manual; a QR
     * scan will send the same code later). The code is only how the door says WHO is standing
     * there: it finds the registration and so the person, nothing else is trusted from it. Same
     * who-may-check-in rules as the event check-in, then in ONE transaction that first locks the
     * event row (so a check-in, a booking cancel and an event cancel take turns): the event is
     * published and not cancelled, the session is in it, scheduled and inside ITS window
     * (`sessionCheckInOpensHoursBefore` before it starts until it ends), the code belongs to a
     * ticket of THIS event (another event's code is a 404), the person holds a seat in THIS
     * session (a walk-in is not counted; a cancelled ticket has no seat, so it fails here too),
     * they have already checked in to the event today (so nobody is in a session without having
     * come through the door), and this seat has not been used. "Today" is the day of this check-in
     * in the event's time zone, the same day the event check-in was written for.
     */
    async checkInToSession(
      eventId: string,
      sessionId: string,
      body: CheckInBody,
      actor: EventActor,
    ): Promise<SessionCheckInDto> {
      if (
        !actor.permissions.has(PERMISSION.REGISTRATION_CHECKIN_ALL) &&
        !actor.permissions.has(PERMISSION.REGISTRATION_CHECKIN_EVENT)
      ) {
        throw new ForbiddenError();
      }
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });

      const at = now();
      return repo.transaction(async (tx) => {
        const event = await repo.lockEvent(tx, eventId);
        if (!event) throw new NotFoundError("Event not found");
        assertEventPublished(event);

        // The session of THIS event: a session of another event is "not found".
        const session = await repo.findSessionForBooking(
          tx,
          eventId,
          sessionId,
        );
        if (!session) throw new NotFoundError("Session not found");
        const sessionStart = assertSessionCheckInOpen(session, at);

        // Who is at the door: the ticket of THIS event that holds the code.
        const found = await repo.findRegistrationByTicketCode(
          tx,
          eventId,
          body.ticketCode,
        );
        if (!found) throw new NotFoundError("Ticket not found");
        const name = `${found.firstName} ${found.lastName}`;

        const booking = await repo.findSessionBooking(
          tx,
          sessionId,
          found.registration.userId,
        );
        if (booking?.status !== "registered") {
          throw new ConflictError(
            "SESSION_NOT_BOOKED",
            `${name} has no seat booked in this session`,
          );
        }

        // The event check-in this one builds on: the one for the event day this SESSION belongs
        // to (the first day whose hours had not ended when the session starts; see eventDayOf).
        // The session check-in window above ensures the session is on now, so this is the day
        // that is running at the event door.
        const eventCheckIn = await repo.findEventCheckIn(
          tx,
          found.registration.id,
          eventDayOf(sessionStart, event),
        );
        if (!eventCheckIn) {
          throw new ConflictError(
            "EVENT_CHECK_IN_REQUIRED",
            `${name} has not checked in to the event today. Check them in at the event door first`,
          );
        }

        const checkIn = await repo.insertSessionCheckIn(tx, {
          sessionRegistrationId: booking.id,
          eventCheckInId: eventCheckIn.id,
          checkedInBy: actor.id,
          at,
        });
        const person = {
          firstName: found.firstName,
          lastName: found.lastName,
          ticketCode: found.registration.ticketCode,
        };
        if (!checkIn) {
          const first = await repo.findSessionCheckIn(tx, booking.id);
          throw new ConflictError(
            "ALREADY_CHECKED_IN",
            `${name} is already checked in to this session`,
            first ? alreadyCheckedInDetails(person, first.checkedInAt) : {},
          );
        }
        return toSessionCheckInDto(checkIn, sessionId, person);
      });
    },

    /**
     * Registers the user for the event. Someone who is already registered gets a 409
     * ALREADY_REGISTERED that says so (their ticket is one `getMyRegistration` away). One
     * transaction: the event row is locked first, so two people cannot both take the last seat,
     * and the seat count, the price and the insert all see the same event.
     */
    async register(
      eventId: string,
      actor: RegistrationActor,
    ): Promise<RegistrationDto> {
      const at = now();

      return repo.transaction(async (tx) => {
        const event = await repo.lockEvent(tx, eventId);
        if (!event) throw new NotFoundError("Event not found");

        // First, so a registered person is told "already registered" and not "closed" or "full".
        const existing = await repo.findRegistration(tx, eventId, actor.id);
        if (existing?.status === "registered") throw alreadyRegistered();

        assertOpenForRegistration(event, at);

        const price = await priceFor(tx, event, actor.id);
        if (price.reason === "paid") {
          throw new ConflictError(
            "PAYMENT_NOT_AVAILABLE_YET",
            "Paid tickets are not available yet",
          );
        }

        // No capacity means no limit.
        if (event.capacity !== null) {
          const seatsTaken = await repo.countSeatsTaken(tx, eventId);
          if (seatsTaken >= event.capacity) {
            throw new ConflictError("EVENT_FULL", "This event is full");
          }
        }

        for (let attempt = 0; attempt < MAX_TICKET_CODE_ATTEMPTS; attempt++) {
          const result = await repo.upsertRegistration(tx, {
            eventId,
            userId: actor.id,
            ticketCode: newTicketCode(),
            at,
          });
          if (result.kind === "saved") {
            return toRegistrationDto(result.registration, price);
          }
          // The event row is locked, so this does not happen today; if another code path that
          // skips the lock ever registers the user in between, the answer is the same.
          if (result.kind === "already_registered") throw alreadyRegistered();
        }
        throw new Error("Could not generate a unique ticket code");
      });
    },

    /**
     * Books the user a seat in one session. Needs a registered event registration, so a person
     * who never registered, or cancelled, is sent back to register first. Booking stops when the
     * session starts, so nobody can book a session that is running or already over, however
     * long ago they registered for the event. Only sessions with `requiresRegistration` have
     * seats. The limit is the hall's capacity; an online session has no hall, so it has no limit
     * (like an event without a capacity). Under the event lock, so the last seat goes to one
     * person. Only free sessions for now. A cancelled booking is revived by booking again.
     */
    async bookSession(
      eventId: string,
      sessionId: string,
      actor: RegistrationActor,
    ): Promise<SessionBookingDto> {
      const at = now();

      return repo.transaction(async (tx) => {
        // The same lock as registering and cancelling: a booking waits for them and they for it.
        const event = await repo.lockEvent(tx, eventId);
        // A draft is not public yet, so it is "not found", not "closed".
        if (!event || event.status === "draft") {
          throw new NotFoundError("Event not found");
        }
        if (event.status === "cancelled") {
          throw new ConflictError(
            "EVENT_CANCELLED",
            "This event was cancelled",
          );
        }

        const session = await repo.findSessionForBooking(
          tx,
          eventId,
          sessionId,
        );
        // A draft session is not on the public schedule, so it is "not found" too.
        if (!session || session.status === "draft") {
          throw new NotFoundError("Session not found");
        }
        if (session.status === "cancelled") {
          throw new ConflictError(
            "SESSION_CANCELLED",
            "This session was cancelled",
          );
        }
        if (!session.requiresRegistration) {
          throw new ConflictError(
            "SESSION_NOT_BOOKABLE",
            "This session does not need a booking",
          );
        }
        // A scheduled session always has a time (a table check), so null is only a type guard.
        if (!session.startAt || session.startAt <= at) {
          throw new ConflictError(
            "SESSION_STARTED",
            "Booking is closed: this session has already started",
          );
        }
        // No hall is normal for an online session (no limit). For an in-person or hybrid session
        // it means the room is not chosen yet, so there is no capacity to count seats against.
        if (session.hallCapacity === null && session.mode !== "online") {
          throw new ConflictError(
            "SESSION_NOT_BOOKABLE",
            "This session has no hall yet, so it cannot be booked",
          );
        }

        // The event registration must be a live one: a cancelled ticket does not count.
        const registration = await repo.findRegistration(tx, eventId, actor.id);
        if (registration?.status !== "registered") {
          throw new ConflictError(
            "EVENT_REGISTRATION_REQUIRED",
            "Register for the event first, then book your seat",
          );
        }

        // Before the speaker, price and seat rules: a booked person hears "already booked".
        const existing = await repo.findSessionBooking(tx, sessionId, actor.id);
        if (existing?.status === "registered") throw alreadyBooked();

        if (await repo.isSpeakerOfSession(tx, actor.id, sessionId)) {
          throw new ConflictError(
            "SPEAKER_CANNOT_BOOK",
            "You are speaking in this session, so you do not need a seat",
          );
        }

        if (session.price > 0) {
          throw new ConflictError(
            "PAYMENT_NOT_AVAILABLE_YET",
            "Paid sessions are not available yet",
          );
        }

        if (session.hallCapacity !== null) {
          const seatsTaken = await repo.countSessionSeatsTaken(tx, sessionId);
          if (seatsTaken >= session.hallCapacity) {
            throw new ConflictError("SESSION_FULL", "This session is full");
          }
        }

        const booking = await repo.upsertSessionBooking(tx, {
          sessionId,
          userId: actor.id,
          at,
        });
        // Null: the row turned `registered` between the read above and this write. The event row
        // is locked, so this does not happen today; the answer is the same if it ever does.
        if (!booking) throw alreadyBooked();
        return toSessionBookingDto(booking);
      });
    },

    /**
     * Cancels the user's own seat in one session; the seat is free again at once. Allowed until
     * registration for the event closes (the same moment cancelling the event registration
     * stops): a seat freed on the event day is too late for anyone else to take. A closing time
     * is never later than the event start, and a session never starts before its event, so this
     * also covers "the session has not started". A seat already used to check in cannot be
     * cancelled. Cancelling twice answers the cancelled booking again. A session of another
     * event, or a seat never booked, is a 404.
     */
    async cancelSessionBooking(
      eventId: string,
      sessionId: string,
      actor: RegistrationActor,
    ): Promise<SessionBookingDto> {
      const at = now();

      return repo.transaction(async (tx) => {
        // The same lock as registering and booking: a cancel waits for them and they for it.
        const event = await repo.lockEvent(tx, eventId);
        if (!event) throw new NotFoundError("Booking not found");

        // The session of THIS event; a cancelled session is allowed, so a leftover seat can go.
        const session = await repo.findSessionForBooking(
          tx,
          eventId,
          sessionId,
        );
        if (!session) throw new NotFoundError("Booking not found");

        const booking = await repo.findSessionBooking(tx, sessionId, actor.id);
        if (!booking) throw new NotFoundError("Booking not found");
        if (booking.status === "cancelled") return toSessionBookingDto(booking);

        // No closing time set means registration closes when the event starts.
        const closesAt = event.registrationClosesAt ?? event.startAt;
        if (at >= closesAt) {
          throw new ConflictError(
            "CANCELLATION_CLOSED",
            "Registration has closed, so this booking can no longer be cancelled",
          );
        }
        if (await repo.hasSessionCheckIn(tx, booking.id)) {
          throw new ConflictError(
            "ALREADY_CHECKED_IN",
            "You have already checked in to this session, so the booking can't be cancelled",
          );
        }

        const cancelled = await repo.cancelSessionBooking(tx, booking.id, at);
        // The event row is locked, so the row is still `registered`; this only guards that.
        if (!cancelled) {
          throw new ConflictError(
            "BOOKING_CHANGED",
            "Your booking changed while you were cancelling. Reload and try again",
          );
        }
        return toSessionBookingDto(cancelled);
      });
    },

    /**
     * Cancels the user's own registration, and the seats they booked in this event's sessions,
     * in one transaction (the seat is free again at once). Allowed until registration closes,
     * the same moment registering stops. Cancelling twice answers the cancelled registration
     * again. The ticket code stays on the cancelled row but no longer works; registering again
     * flips the row back with a new code. No refund: every ticket so far was free or complimentary.
     * Answers what `getMyRegistration` would answer now.
     */
    async cancelMyRegistration(
      eventId: string,
      actor: RegistrationActor,
    ): Promise<MyRegistrationDto> {
      const at = now();

      return repo.transaction(async (tx) => {
        // The same lock as registering: a cancel and a register for this event take turns.
        const event = await repo.lockEvent(tx, eventId);
        if (!event) throw new NotFoundError("Registration not found");
        const existing = await repo.findRegistration(tx, eventId, actor.id);
        if (!existing) throw new NotFoundError("Registration not found");

        const price = heldTicketPrice(event);
        if (existing.status === "cancelled") {
          return {
            registration: toRegistrationDto(existing, price),
            bookedSessionIds: [],
          };
        }

        // No closing time set means registration closes when the event starts.
        const closesAt = event.registrationClosesAt ?? event.startAt;
        if (at >= closesAt) {
          throw new ConflictError(
            "CANCELLATION_CLOSED",
            "Registration has closed, so it can no longer be cancelled",
          );
        }
        // can not cancel event if you are chck in
        if (await repo.hasCheckIn(tx, existing.id)) {
          throw new ConflictError(
            "ALREADY_CHECKED_IN",
            "You have already checked in, so this registration can't be cancelled",
          );
        }

        const cancelled = await repo.cancelRegistration(tx, existing.id, at);
        // The event row is locked, so the row is still `registered`; this only guards that.
        if (!cancelled) {
          throw new ConflictError(
            "REGISTRATION_CHANGED",
            "Your registration changed while you were cancelling. Reload and try again",
          );
        }
        await repo.cancelSessionBookings(tx, eventId, actor.id, at);

        return {
          registration: toRegistrationDto(cancelled, price),
          bookedSessionIds: [],
        };
      });
    },
  };
}

export type RegistrationService = ReturnType<typeof createRegistrationService>;

export const registrationService = createRegistrationService({
  registrationRepository,
  eventAccess,
  checkInOpensHoursBefore: env.CHECK_IN_OPENS_HOURS_BEFORE,
  sessionCheckInOpensHoursBefore: env.SESSION_CHECK_IN_OPENS_HOURS_BEFORE,
});
