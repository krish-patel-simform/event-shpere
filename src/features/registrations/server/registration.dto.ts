import "server-only";
import type {
  EventCheckIn,
  EventRecord,
  EventRegistration,
  SessionCheckIn,
  SessionRegistration,
} from "../../../db/schemas";
import type {
  AttendeeDto,
  SessionAttendeeDto,
} from "../schemas/attendees.schemas";
import type {
  AlreadyCheckedInDetails,
  CheckInDto,
  CheckInLogItemDto,
  SessionCheckInDto,
} from "../schemas/check-ins.schemas";
import type {
  MyTicketDto,
  RegistrationDto,
  RegistrationReason,
  SessionBookingDto,
} from "../schemas/registrations.schemas";
import type {
  AttendeeRow,
  CheckInLogRow,
  MyRegistrationRow,
  SessionAttendeeRow,
} from "./registration.repository";

/** What the ticket costs this user, worked out by the service (the table does not store it). */
export type RegistrationPrice = {
  /** Paise. */
  amount: number;
  currency: string;
  reason: RegistrationReason;
};

/**
 * What a ticket the user already holds cost. Every ticket so far cost nothing: free on a free
 * event, complimentary on a paid one (only a speaker of the event gets in without paying). Once
 * tickets are paid this reads the payment instead. One rule, so registering and reading the
 * status always agree.
 */
export function heldTicketPrice(
  event: Pick<EventRecord, "ticketPrice" | "currency">,
): RegistrationPrice {
  return {
    amount: 0,
    currency: event.currency,
    reason: event.ticketPrice === 0 ? "free" : "complimentary_speaker",
  };
}

/**
 * The user's own ticket, field by field: never the user id, `updatedAt` or `cancelledAt`, and
 * the dates as ISO strings.
 */
export function toRegistrationDto(
  row: EventRegistration,
  price: RegistrationPrice,
): RegistrationDto {
  return {
    id: row.id,
    eventId: row.eventId,
    status: row.status,
    ticketCode: row.ticketCode,
    amount: price.amount,
    currency: price.currency,
    reason: price.reason,
    registeredAt: row.registeredAt.toISOString(),
  };
}

/** The user's own seat booking, field by field: never the user id, `updatedAt` or `cancelledAt`. */
export function toSessionBookingDto(
  row: SessionRegistration,
): SessionBookingDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    status: row.status,
    registeredAt: row.registeredAt.toISOString(),
  };
}

/**
 * One line of the organizer's attendee list, field by field: the person's name and email and
 * the ticket, never the user id, and the dates as ISO strings.
 */
export function toAttendeeDto(row: AttendeeRow): AttendeeDto {
  return {
    registrationId: row.registrationId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    ticketCode: row.ticketCode,
    status: row.status,
    registeredAt: row.registeredAt.toISOString(),
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
    // Name only, never the staff member's id; null when nobody is recorded (or not checked in).
    checkedInBy:
      row.checkedByFirstName && row.checkedByLastName
        ? { firstName: row.checkedByFirstName, lastName: row.checkedByLastName }
        : null,
    checkInMethod: row.checkInMethod,
  };
}

/**
 * One seat of a session's attendee list, field by field: the person's name and email, their
 * ticket and the check-in time, never the user id, and the dates as ISO strings.
 */
export function toSessionAttendeeDto(
  row: SessionAttendeeRow,
): SessionAttendeeDto {
  return {
    bookingId: row.bookingId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    ticketCode: row.ticketCode,
    status: row.status,
    bookedAt: row.bookedAt.toISOString(),
    checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
  };
}

/**
 * The answer to a check-in: the check-in itself and who walked in (name and ticket code, never
 * the email or the user id), with the time as an ISO string.
 */
export function toCheckInDto(
  checkIn: EventCheckIn,
  person: { firstName: string; lastName: string; ticketCode: string },
): CheckInDto {
  return {
    id: checkIn.id,
    registrationId: checkIn.registrationId,
    attendanceDate: checkIn.attendanceDate,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    method: checkIn.method,
    attendee: {
      firstName: person.firstName,
      lastName: person.lastName,
      ticketCode: person.ticketCode,
    },
  };
}

/**
 * The answer to a session check-in: the check-in and who walked in (name and ticket code, never
 * the email or the user id). The row only knows the seat, so the caller passes the session.
 */
/** The `details` of a 409 ALREADY_CHECKED_IN: who it is and when they were first checked in. */
export function alreadyCheckedInDetails(
  person: { firstName: string; lastName: string; ticketCode: string },
  firstCheckedInAt: Date,
): AlreadyCheckedInDetails {
  return {
    attendee: {
      firstName: person.firstName,
      lastName: person.lastName,
      ticketCode: person.ticketCode,
    },
    checkedInAt: firstCheckedInAt.toISOString(),
  };
}

export function toSessionCheckInDto(
  checkIn: SessionCheckIn,
  sessionId: string,
  person: { firstName: string; lastName: string; ticketCode: string },
): SessionCheckInDto {
  return {
    id: checkIn.id,
    sessionId,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    method: checkIn.method,
    attendee: {
      firstName: person.firstName,
      lastName: person.lastName,
      ticketCode: person.ticketCode,
    },
  };
}

/**
 * One line of the check-in log, field by field: the person and the ticket, the day and the time,
 * and who checked them in by name only (never a user id), null when nobody is recorded.
 */
export function toCheckInLogItemDto(row: CheckInLogRow): CheckInLogItemDto {
  return {
    id: row.id,
    registrationId: row.registrationId,
    attendanceDate: row.attendanceDate,
    checkedInAt: row.checkedInAt.toISOString(),
    method: row.method,
    attendee: {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      ticketCode: row.ticketCode,
    },
    checkedInBy:
      row.checkedByFirstName !== null && row.checkedByLastName !== null
        ? { firstName: row.checkedByFirstName, lastName: row.checkedByLastName }
        : null,
  };
}

/**
 * One "My tickets" card: the user's ticket (priced like every held ticket), the event fields the
 * card shows and how many sessions they booked. Of the registration window only the closing time
 * is sent (it is when cancelling stops, so the card can hide "Cancel"); nothing else of the event
 * (capacity, organizer, opening time) leaves the server here.
 */
export function toMyTicketDto(row: MyRegistrationRow): MyTicketDto {
  return {
    registration: toRegistrationDto(
      row.registration,
      heldTicketPrice(row.event),
    ),
    event: {
      id: row.event.id,
      slug: row.event.slug,
      title: row.event.title,
      status: row.event.status,
      startAt: row.event.startAt.toISOString(),
      endAt: row.event.endAt.toISOString(),
      timezone: row.event.timezone,
      registrationClosesAt:
        row.event.registrationClosesAt?.toISOString() ?? null,
      venueName: row.venueName,
      venueCity: row.venueCity,
    },
    bookedSessionCount: row.bookedSessionCount,
  };
}
