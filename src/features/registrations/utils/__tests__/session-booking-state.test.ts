import { ApiError } from "../../../../core/api-client/base-api.service";
import type {
  MyRegistrationDto,
  RegistrationDto,
} from "../../schemas/registrations.schemas";
import {
  bookingFailureMessage,
  sessionBookingState,
  type SessionBookingEvent,
  type SessionBookingInput,
  type SessionBookingTarget,
} from "../session-booking-state";

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const OTHER_SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02";

// Registration closes 2 Dec 18:00 IST; the event starts 3 Dec; this session is on 4 Dec, 10:00.
const event = (
  overrides: Partial<SessionBookingEvent> = {},
): SessionBookingEvent => ({
  id: EVENT_ID,
  status: "published",
  startAt: "2026-12-03T03:30:00.000Z",
  registrationClosesAt: "2026-12-02T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  ...overrides,
});

const session = (
  overrides: Partial<SessionBookingTarget> = {},
): SessionBookingTarget => ({
  id: SESSION_ID,
  startAt: "2026-12-04T04:30:00.000Z",
  mode: "in_person",
  hallName: "Hall B",
  requiresRegistration: true,
  price: 0,
  seatsLeft: 32,
  ...overrides,
});

const registration = (
  overrides: Partial<RegistrationDto> = {},
): RegistrationDto => ({
  id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
  eventId: EVENT_ID,
  status: "registered",
  ticketCode: "ESEVT7K3Q9P",
  amount: 0,
  currency: "INR",
  reason: "free",
  registeredAt: "2026-11-10T10:00:00.000Z",
  ...overrides,
});

const REGISTERED: MyRegistrationDto = {
  registration: registration(),
  bookedSessionIds: [OTHER_SESSION_ID],
};
const BOOKED: MyRegistrationDto = {
  registration: registration(),
  bookedSessionIds: [OTHER_SESSION_ID, SESSION_ID],
};

/** Before registration closes, well before the session. */
const NOW = new Date("2026-11-20T10:00:00.000Z");

const conflict = (code: string) => new ApiError(409, code, code);

/** A registered attendee without a seat, on a bookable free in-person session, unless told otherwise. */
function stateOf(overrides: Partial<SessionBookingInput> = {}) {
  return sessionBookingState({
    session: session(),
    event: event(),
    viewer: "attendee",
    standing: REGISTERED,
    standingFailed: false,
    bookError: null,
    cancelError: null,
    now: NOW,
    ...overrides,
  });
}

describe("sessionBookingState", () => {
  describe("what is true for everyone", () => {
    it.each(["loading", "guest", "staff", "attendee", "unknown"] as const)(
      "a cancelled event cannot be booked (%s)",
      (viewer) => {
        expect(
          stateOf({ event: event({ status: "cancelled" }), viewer }),
        ).toEqual({ kind: "event_cancelled" });
      },
    );

    it("a cancelled event wins even over a held seat (the server cancelled it)", () => {
      expect(
        stateOf({ event: event({ status: "cancelled" }), standing: BOOKED }),
      ).toEqual({ kind: "event_cancelled" });
    });

    it("the server's EVENT_CANCELLED and SESSION_CANCELLED are shown", () => {
      expect(stateOf({ bookError: conflict("EVENT_CANCELLED") })).toEqual({
        kind: "event_cancelled",
      });
      expect(stateOf({ bookError: conflict("SESSION_CANCELLED") })).toEqual({
        kind: "session_cancelled",
      });
    });

    it.each(["guest", "staff", "attendee"] as const)(
      "a session without booking says so (%s)",
      (viewer) => {
        expect(
          stateOf({
            session: session({ requiresRegistration: false }),
            viewer,
          }),
        ).toEqual({ kind: "no_booking_needed" });
      },
    );
  });

  describe("who is looking", () => {
    it("waits while the account loads", () => {
      expect(stateOf({ viewer: "loading" })).toEqual({ kind: "loading" });
    });

    it("says the account could not be checked", () => {
      expect(stateOf({ viewer: "unknown" })).toEqual({ kind: "account_error" });
    });

    it("asks a guest to sign in", () => {
      expect(stateOf({ viewer: "guest" })).toEqual({ kind: "signed_out" });
    });

    it("tells a guest booking is closed once the session started", () => {
      expect(
        stateOf({ viewer: "guest", now: new Date("2026-12-04T04:30:00.000Z") }),
      ).toEqual({ kind: "started" });
    });

    it("tells an organizer or admin they cannot book with this account", () => {
      expect(stateOf({ viewer: "staff" })).toEqual({ kind: "staff" });
    });

    it("waits for the standing, and shows its failure, never an old answer", () => {
      expect(stateOf({ standing: undefined })).toEqual({ kind: "loading" });
      expect(stateOf({ standing: BOOKED, standingFailed: true })).toEqual({
        kind: "standing_error",
      });
    });
  });

  describe("a seat the user holds", () => {
    it("is shown as booked, cancellable until event registration closes", () => {
      expect(stateOf({ standing: BOOKED })).toEqual({
        kind: "booked",
        canCancel: true,
        cancelUntil: "2026-12-02T12:30:00.000Z",
      });
    });

    it("can be cancelled until the event starts when no closing time is set", () => {
      expect(
        stateOf({
          standing: BOOKED,
          event: event({ registrationClosesAt: null }),
        }),
      ).toMatchObject({
        kind: "booked",
        cancelUntil: "2026-12-03T03:30:00.000Z",
      });
    });

    it("can no longer be cancelled at the very closing moment", () => {
      expect(
        stateOf({
          standing: BOOKED,
          now: new Date("2026-12-02T12:30:00.000Z"),
        }),
      ).toMatchObject({ kind: "booked", canCancel: false });
    });

    it("can no longer be cancelled once the server said CANCELLATION_CLOSED", () => {
      expect(
        stateOf({
          standing: BOOKED,
          cancelError: conflict("CANCELLATION_CLOSED"),
        }),
      ).toMatchObject({ kind: "booked", canCancel: false });
    });

    it("is shown as checked in when the cancel was refused with ALREADY_CHECKED_IN", () => {
      expect(
        stateOf({
          standing: BOOKED,
          cancelError: conflict("ALREADY_CHECKED_IN"),
        }),
      ).toEqual({ kind: "checked_in" });
    });

    it("is still shown after the session started (not 'booking closed')", () => {
      expect(
        stateOf({
          standing: BOOKED,
          now: new Date("2026-12-04T05:00:00.000Z"),
        }),
      ).toMatchObject({ kind: "booked", canCancel: false });
    });

    it("is still shown on a full session (it is one of the taken seats)", () => {
      expect(
        stateOf({ standing: BOOKED, session: session({ seatsLeft: 0 }) }),
      ).toMatchObject({ kind: "booked" });
    });

    it("stays cancellable after a busy server (503)", () => {
      expect(
        stateOf({
          standing: BOOKED,
          cancelError: new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
        }),
      ).toMatchObject({ kind: "booked", canCancel: true });
    });
  });

  describe("can they book? (route 8's order)", () => {
    it("is open, with the cancel deadline", () => {
      expect(stateOf()).toEqual({
        kind: "open",
        cancelUntil: "2026-12-02T12:30:00.000Z",
        unlimited: false,
      });
    });

    it("is open with no seat limit for an online session", () => {
      expect(
        stateOf({
          session: session({ mode: "online", hallName: null, seatsLeft: null }),
        }),
      ).toMatchObject({ kind: "open", unlimited: true });
    });

    it("is closed from the very start of the session", () => {
      expect(stateOf({ now: new Date("2026-12-04T04:30:00.000Z") })).toEqual({
        kind: "started",
      });
    });

    it("is closed when the server says SESSION_STARTED (its clock wins)", () => {
      expect(stateOf({ bookError: conflict("SESSION_STARTED") })).toEqual({
        kind: "started",
      });
    });

    it("opens later when the session has no time yet", () => {
      expect(stateOf({ session: session({ startAt: null }) })).toEqual({
        kind: "opens_soon",
        reason: "time",
      });
    });

    it.each(["in_person", "hybrid"])(
      "opens later when a %s session has no hall yet",
      (mode) => {
        expect(
          stateOf({
            session: session({ mode, hallName: null, seatsLeft: null }),
          }),
        ).toEqual({ kind: "opens_soon", reason: "hall" });
      },
    );

    it("opens later when the server says SESSION_NOT_BOOKABLE", () => {
      expect(stateOf({ bookError: conflict("SESSION_NOT_BOOKABLE") })).toEqual({
        kind: "opens_soon",
        reason: "hall",
      });
    });

    it("asks to register for the event first (never registered)", () => {
      expect(
        stateOf({
          standing: { registration: null, bookedSessionIds: [] },
        }),
      ).toEqual({ kind: "register_first", cancelledBefore: false });
    });

    it("asks to register again when the event registration was cancelled", () => {
      expect(
        stateOf({
          standing: {
            registration: registration({ status: "cancelled" }),
            bookedSessionIds: [],
          },
        }),
      ).toEqual({ kind: "register_first", cancelledBefore: true });
    });

    it("asks to register when the server says EVENT_REGISTRATION_REQUIRED (cancelled in another tab)", () => {
      expect(
        stateOf({ bookError: conflict("EVENT_REGISTRATION_REQUIRED") }),
      ).toMatchObject({ kind: "register_first" });
    });

    it("tells a speaker of the session they do not book", () => {
      expect(stateOf({ bookError: conflict("SPEAKER_CANNOT_BOOK") })).toEqual({
        kind: "speaker",
      });
    });

    it("switches a paid session off before any click", () => {
      expect(stateOf({ session: session({ price: 50000 }) })).toEqual({
        kind: "paid_unavailable",
      });
    });

    it("shows the server's PAYMENT_NOT_AVAILABLE_YET", () => {
      expect(
        stateOf({ bookError: conflict("PAYMENT_NOT_AVAILABLE_YET") }),
      ).toEqual({ kind: "paid_unavailable" });
    });

    it("is full with no seats left, or when the server says SESSION_FULL", () => {
      expect(stateOf({ session: session({ seatsLeft: 0 }) })).toEqual({
        kind: "full",
      });
      expect(stateOf({ bookError: conflict("SESSION_FULL") })).toEqual({
        kind: "full",
      });
    });
  });

  describe("checks run in the server's order", () => {
    it("started beats no hall, no registration, paid and full", () => {
      expect(
        stateOf({
          session: session({ hallName: null, price: 100, seatsLeft: 0 }),
          standing: { registration: null, bookedSessionIds: [] },
          now: new Date("2026-12-05T00:00:00.000Z"),
        }),
      ).toEqual({ kind: "started" });
    });

    it("no hall beats no registration", () => {
      expect(
        stateOf({
          session: session({ hallName: null }),
          standing: { registration: null, bookedSessionIds: [] },
        }),
      ).toMatchObject({ kind: "opens_soon" });
    });

    it("no registration beats paid and full", () => {
      expect(
        stateOf({
          session: session({ price: 100, seatsLeft: 0 }),
          standing: { registration: null, bookedSessionIds: [] },
        }),
      ).toMatchObject({ kind: "register_first" });
    });

    it("paid beats full", () => {
      expect(
        stateOf({ session: session({ price: 100, seatsLeft: 0 }) }),
      ).toEqual({ kind: "paid_unavailable" });
    });
  });

  describe("errors that do not change the state", () => {
    it.each([
      new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
      new ApiError(429, "RATE_LIMITED", "slow"),
      new ApiError(0, "NETWORK_ERROR", "offline"),
      conflict("ALREADY_BOOKED"),
      new ApiError(400, "SESSION_FULL", "not a 409"),
    ])("%s keeps the card open", (bookError) => {
      expect(stateOf({ bookError })).toMatchObject({ kind: "open" });
    });
  });
});

describe("bookingFailureMessage", () => {
  it("is null without an error", () => {
    expect(bookingFailureMessage(null)).toBeNull();
  });

  it.each([
    "EVENT_CANCELLED",
    "SESSION_CANCELLED",
    "SESSION_NOT_BOOKABLE",
    "SESSION_STARTED",
    "EVENT_REGISTRATION_REQUIRED",
    "SPEAKER_CANNOT_BOOK",
    "PAYMENT_NOT_AVAILABLE_YET",
    "SESSION_FULL",
    "CANCELLATION_CLOSED",
    "ALREADY_CHECKED_IN",
    "ALREADY_BOOKED",
  ])("is null for %s: the card's state already says it", (code) => {
    expect(bookingFailureMessage(conflict(code))).toBeNull();
  });

  it.each([
    [conflict("BOOKING_CHANGED"), /seat changed while we were cancelling/],
    [new ApiError(404, "NOT_FOUND", ""), /could not be found any more/],
    [new ApiError(429, "RATE_LIMITED", ""), /too often/],
    [new ApiError(0, "NETWORK_ERROR", ""), /reach the server/],
    [new ApiError(503, "SERVICE_UNAVAILABLE", ""), /busy/],
  ])("explains %s", (error, message) => {
    expect(bookingFailureMessage(error)).toMatch(message);
  });
});
