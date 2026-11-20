import { PERMISSION } from "../../../core/auth/permission-catalog";
import type {
  EventCheckIn,
  EventRecord,
  EventRegistration,
  SessionCheckIn,
  SessionRegistration,
} from "../../../db/schemas";
import type { EventActor } from "../../events/server";
import type {
  AttendeeRow,
  CheckInLogRow,
  DbTransaction,
  MyRegistrationRow,
  RegistrationRepository,
  SessionAttendeeRow,
  SessionForBooking,
} from "../server/registration.repository";
import { createRegistrationService } from "../server/registration.service";

// The service imports the events feature's server entry for the real ownership rule, which pulls
// in the database client. Tests inject a fake `eventAccess`, so the entry is never loaded.
jest.mock("../../events/server", () => ({}));

// The service file builds its real instance on import, which reads the env settings. Tests build
// their own service and pass the values in, so the real env is never loaded or validated.
jest.mock("../../../config/env", () => ({
  env: {
    CHECK_IN_OPENS_HOURS_BEFORE: 6,
    SESSION_CHECK_IN_OPENS_HOURS_BEFORE: 2,
  },
}));

// Shared by the service tests. A test file must still call
// jest.mock("../registration.repository", () => ({})) before importing this, so the database
// client is never loaded.

export const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
export const userId = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
export const registrationId = "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f";

/** The "now" of every service test, so nothing depends on the real clock. */
export const NOW = new Date("2026-11-02T10:00:00.000Z");

export const actor = { id: userId };

/** A published, free, not-yet-started event with room: the one a user may register for. */
export const publishedEvent: EventRecord = {
  id: eventId,
  organizerId: "5d1c3a4b-7e8f-4a1b-9c2d-3e4f5a6b7c8d",
  title: "Fintech Product Forum",
  slug: "fintech-product-forum",
  status: "published",
  startAt: new Date("2026-12-12T04:00:00.000Z"),
  endAt: new Date("2026-12-12T12:00:00.000Z"),
  timezone: "Asia/Kolkata",
  venueId: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  capacity: 250,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  cmsEventId: "doc-1",
  publishedAt: new Date("2026-10-30T10:00:00.000Z"),
  cancelledAt: null,
  createdAt: new Date("2026-10-30T10:00:00.000Z"),
  updatedAt: new Date("2026-10-30T10:00:00.000Z"),
};

export const heldRegistration: EventRegistration = {
  id: registrationId,
  eventId,
  userId,
  status: "registered",
  ticketCode: "ESEVT7K3Q9P",
  registeredAt: new Date("2026-11-01T08:00:00.000Z"),
  cancelledAt: null,
  updatedAt: new Date("2026-11-01T08:00:00.000Z"),
};

export const cancelledRegistration: EventRegistration = {
  ...heldRegistration,
  status: "cancelled",
  cancelledAt: new Date("2026-11-01T09:00:00.000Z"),
};

export const sessionId = "4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a";

/** A scheduled in-person workshop that needs a booking, has 30 seats, is free and starts later. */
export const bookableSession: SessionForBooking = {
  id: sessionId,
  eventId,
  status: "scheduled",
  mode: "in_person",
  startAt: new Date("2026-12-12T05:00:00.000Z"),
  endAt: new Date("2026-12-12T07:00:00.000Z"),
  requiresRegistration: true,
  price: 0,
  hallCapacity: 30,
};

/** The booking row the repository answers after writing one. */
export const heldBooking: SessionRegistration = {
  id: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b",
  sessionId,
  userId,
  status: "registered",
  registeredAt: NOW,
  cancelledAt: null,
  updatedAt: NOW,
};

/** The session check-in row the repository answers after writing one. */
export const sessionCheckInRow: SessionCheckIn = {
  id: "6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f8a9b0c",
  sessionRegistrationId: heldBooking.id,
  eventCheckInId: "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  checkedInAt: new Date("2026-12-12T04:30:00.000Z"),
  checkedInBy: "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
  method: "manual",
};

/** The same booking after a cancel. */
export const cancelledBooking: SessionRegistration = {
  ...heldBooking,
  status: "cancelled",
  cancelledAt: new Date("2026-11-03T09:00:00.000Z"),
};

/** An approved organizer: may list the attendees of events they organize. */
export const organizerActor: EventActor = {
  id: "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
  role: "organizer",
  permissions: new Set([
    PERMISSION.EVENT_MANAGE_OWN,
    PERMISSION.REGISTRATION_VIEW_EVENT,
    PERMISSION.REGISTRATION_CHECKIN_EVENT,
  ]),
};

/** An admin: may list the attendees of, and check people in at, any event. */
export const adminActor: EventActor = {
  id: "7f8a9b0c-1d2e-4f3a-9b4c-5d6e7f8a9b0c",
  role: "admin",
  permissions: new Set([
    PERMISSION.EVENT_MANAGE_ALL,
    PERMISSION.REGISTRATION_VIEW_ALL,
    PERMISSION.REGISTRATION_CHECKIN_ALL,
  ]),
};

/** The person a ticket code belongs to, as the repository finds it for a check-in. */
export const ticketHolder = {
  registration: heldRegistration,
  firstName: "Priya",
  lastName: "Shah",
};

/** The check-in row the repository answers after writing one. */
export const eventCheckInRow: EventCheckIn = {
  id: "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  registrationId,
  attendanceDate: "2026-12-12",
  checkedInAt: new Date("2026-12-12T03:30:00.000Z"),
  checkedInBy: organizerActor.id,
  method: "manual",
};

/** One line of the check-in log from the repository: Priya, checked in by the organizer. */
export const checkInLogRow: CheckInLogRow = {
  id: eventCheckInRow.id,
  registrationId,
  attendanceDate: "2026-12-12",
  checkedInAt: new Date("2026-12-12T03:30:00.000Z"),
  method: "manual",
  firstName: "Priya",
  lastName: "Shah",
  email: "priya@example.com",
  ticketCode: "ESEVT7K3Q9P",
  checkedByFirstName: "Omkar",
  checkedByLastName: "Patil",
};

/** One line of the organizer's attendee list from the repository. */
export const attendeeRow: AttendeeRow = {
  registrationId,
  firstName: "Priya",
  lastName: "Shah",
  email: "priya@example.com",
  ticketCode: "ESEVT7K3Q9P",
  status: "registered",
  registeredAt: new Date("2026-11-01T08:00:00.000Z"),
  checkedInAt: null,
  checkedByFirstName: null,
  checkedByLastName: null,
  checkInMethod: null,
};

/** One line of a session's attendee list from the repository: Priya's seat, not checked in. */
export const sessionAttendeeRow: SessionAttendeeRow = {
  bookingId: heldBooking.id,
  firstName: "Priya",
  lastName: "Shah",
  email: "priya@example.com",
  ticketCode: "ESEVT7K3Q9P",
  status: "registered",
  bookedAt: NOW,
  checkedInAt: null,
};

/** One "My tickets" row from the repository: the held registration for the published event. */
export const ticketRow: MyRegistrationRow = {
  registration: heldRegistration,
  event: {
    id: publishedEvent.id,
    slug: publishedEvent.slug,
    title: publishedEvent.title,
    status: publishedEvent.status,
    startAt: publishedEvent.startAt,
    endAt: publishedEvent.endAt,
    timezone: publishedEvent.timezone,
    ticketPrice: publishedEvent.ticketPrice,
    currency: publishedEvent.currency,
  },
  venueName: "Grand Hall",
  venueCity: "Pune",
  bookedSessionCount: 2,
};

/**
 * `now` is the service's clock: a test moves it to be before, inside or after a time window.
 * `checkInOpensHoursBefore` is left out to get the production default (6).
 */
export function setupRegistrationService(
  now: Date = NOW,
  options: {
    checkInOpensHoursBefore?: number;
    sessionCheckInOpensHoursBefore?: number;
  } = {},
) {
  // The transaction callback gets this stand-in; the fake repository ignores it.
  const tx = {} as DbTransaction;

  const repo = {
    transaction: jest.fn((work: (tx: DbTransaction) => Promise<unknown>) =>
      work(tx),
    ),
    lockEvent: jest.fn().mockResolvedValue(publishedEvent),
    findRegistration: jest.fn().mockResolvedValue(null),
    findOwnRegistration: jest.fn().mockResolvedValue(null),
    findBookedSessionIds: jest.fn().mockResolvedValue([]),
    listOwnRegistrations: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    listAttendees: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    listCheckIns: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    countAttendees: jest.fn().mockResolvedValue({
      registered: 0,
      cancelled: 0,
      checkedIn: 0,
      pending: 0,
    }),
    hasCheckIn: jest.fn().mockResolvedValue(false),
    sessionExistsInEvent: jest.fn().mockResolvedValue(true),
    listSessionAttendees: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    countSessionAttendees: jest.fn().mockResolvedValue({
      registered: 0,
      cancelled: 0,
      checkedIn: 0,
      pending: 0,
    }),
    findEventCheckIn: jest.fn().mockResolvedValue(eventCheckInRow),
    insertSessionCheckIn: jest.fn().mockResolvedValue(sessionCheckInRow),
    findRegistrationByTicketCode: jest.fn().mockResolvedValue(null),
    insertEventCheckIn: jest.fn().mockResolvedValue(eventCheckInRow),
    cancelRegistration: jest.fn().mockResolvedValue(cancelledRegistration),
    cancelSessionBookings: jest.fn().mockResolvedValue(0),
    countSeatsTaken: jest.fn().mockResolvedValue(0),
    isSpeakerOfEvent: jest.fn().mockResolvedValue(false),
    findSessionForBooking: jest.fn().mockResolvedValue(bookableSession),
    findSessionBooking: jest.fn().mockResolvedValue(null),
    isSpeakerOfSession: jest.fn().mockResolvedValue(false),
    countSessionSeatsTaken: jest.fn().mockResolvedValue(0),
    upsertSessionBooking: jest.fn().mockResolvedValue(heldBooking),
    hasSessionCheckIn: jest.fn().mockResolvedValue(false),
    cancelSessionBooking: jest.fn().mockResolvedValue(cancelledBooking),
    upsertRegistration: jest.fn().mockResolvedValue({
      kind: "saved",
      registration: heldRegistration,
    }),
  };

  const newTicketCode = jest.fn().mockReturnValue("ESEVT7K3Q9P");

  // Reaches the event: the real one answers 404 for somebody else's event and throws for an
  // unapproved organizer; a test makes this reject to play those cases.
  const eventAccess = {
    getEventIfOrgOwns: jest.fn().mockResolvedValue(publishedEvent),
  };

  const service = createRegistrationService({
    registrationRepository: repo as unknown as RegistrationRepository,
    eventAccess,
    now: () => now,
    newTicketCode,
    checkInOpensHoursBefore: options.checkInOpensHoursBefore,
    sessionCheckInOpensHoursBefore: options.sessionCheckInOpensHoursBefore,
  });

  return { service, repo, tx, newTicketCode, eventAccess };
}
