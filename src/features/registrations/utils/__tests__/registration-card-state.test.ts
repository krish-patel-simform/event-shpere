import { ApiError } from "../../../../core/api-client/base-api.service";
import type {
  MyRegistrationDto,
  RegistrationDto,
} from "../../schemas/registrations.schemas";
import {
  registrationCardState,
  registrationClosesAt,
  registrationFailureMessage,
  type RegistrationCardEvent,
  type RegistrationCardInput,
} from "../registration-card-state";

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";

// Opens 1 Nov, closes 2 Dec 18:00 IST, runs 3–5 Dec.
const event = (
  overrides: Partial<RegistrationCardEvent> = {},
): RegistrationCardEvent => ({
  id: EVENT_ID,
  status: "published",
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
  ticketPrice: 0,
  seatsLeft: 120,
  registrationOpensAt: "2026-11-01T04:30:00.000Z",
  registrationClosesAt: "2026-12-02T12:30:00.000Z",
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

const standing = (
  reg: RegistrationDto | null,
  bookedSessionIds: string[] = [],
): MyRegistrationDto => ({ registration: reg, bookedSessionIds });

const NOT_REGISTERED = standing(null);
/** Registration is open, the event has not started. */
const NOW = new Date("2026-11-20T10:00:00.000Z");

const conflict = (code: string) => new ApiError(409, code, code);

/** An attendee who never registered, on an open free event, unless told otherwise. */
function stateOf(overrides: Partial<RegistrationCardInput> = {}) {
  return registrationCardState({
    event: event(),
    viewer: "attendee",
    standing: NOT_REGISTERED,
    standingFailed: false,
    registerError: null,
    cancelError: null,
    now: NOW,
    ...overrides,
  });
}

describe("registrationClosesAt", () => {
  it("is the closing time the organizer set", () => {
    expect(registrationClosesAt(event())).toBe("2026-12-02T12:30:00.000Z");
  });

  it("is the event start when no closing time is set", () => {
    expect(registrationClosesAt(event({ registrationClosesAt: null }))).toBe(
      "2026-12-03T03:30:00.000Z",
    );
  });
});

describe("registrationCardState", () => {
  describe("a cancelled event wins over everything", () => {
    it.each(["loading", "guest", "staff", "attendee", "unknown"] as const)(
      "for a %s viewer",
      (viewer) => {
        expect(
          stateOf({ event: event({ status: "cancelled" }), viewer }),
        ).toEqual({ kind: "event_cancelled" });
      },
    );

    it("even for someone who was registered (the server cancelled them too)", () => {
      expect(
        stateOf({
          event: event({ status: "cancelled" }),
          standing: standing(registration()),
        }),
      ).toEqual({ kind: "event_cancelled" });
    });

    it("also when the page thought it was published but the server said EVENT_CANCELLED", () => {
      expect(stateOf({ registerError: conflict("EVENT_CANCELLED") })).toEqual({
        kind: "event_cancelled",
      });
    });
  });

  describe("who is looking", () => {
    it("waits while the account loads", () => {
      expect(stateOf({ viewer: "loading" })).toEqual({ kind: "loading" });
    });

    it("says the account could not be checked (not a 401)", () => {
      expect(stateOf({ viewer: "unknown" })).toEqual({ kind: "account_error" });
    });

    it("asks a guest to sign in", () => {
      expect(stateOf({ viewer: "guest" })).toEqual({ kind: "signed_out" });
    });

    it("tells a guest an ended event has ended, not to sign in", () => {
      expect(
        stateOf({ viewer: "guest", now: new Date("2026-12-06T00:00:00.000Z") }),
      ).toEqual({ kind: "event_ended" });
    });

    it("tells an organizer or admin they cannot register with this account", () => {
      expect(stateOf({ viewer: "staff" })).toEqual({ kind: "staff" });
    });

    it("tells staff an ended event has ended", () => {
      expect(
        stateOf({ viewer: "staff", now: new Date("2026-12-06T00:00:00.000Z") }),
      ).toEqual({ kind: "event_ended" });
    });
  });

  describe("the attendee's standing (route 2)", () => {
    it("waits while it loads", () => {
      expect(stateOf({ standing: undefined })).toEqual({ kind: "loading" });
    });

    it("shows an error when it failed, never an old answer", () => {
      expect(
        stateOf({ standing: standing(registration()), standingFailed: true }),
      ).toEqual({ kind: "standing_error" });
    });
  });

  describe("registered", () => {
    it("shows the ticket, the booked sessions and until when it can be cancelled", () => {
      const reg = registration();
      expect(
        stateOf({ standing: standing(reg, ["s-1", "s-2", "s-3"]) }),
      ).toEqual({
        kind: "registered",
        registration: reg,
        bookedCount: 3,
        canCancel: true,
        cancelUntil: "2026-12-02T12:30:00.000Z",
      });
    });

    it("can be cancelled until the event starts when no closing time is set", () => {
      const state = stateOf({
        event: event({ registrationClosesAt: null }),
        standing: standing(registration()),
        now: new Date("2026-12-03T03:29:00.000Z"),
      });
      expect(state).toMatchObject({
        kind: "registered",
        canCancel: true,
        cancelUntil: "2026-12-03T03:30:00.000Z",
      });
    });

    it("can no longer be cancelled at the very moment registration closes", () => {
      expect(
        stateOf({
          standing: standing(registration()),
          now: new Date("2026-12-02T12:30:00.000Z"),
        }),
      ).toMatchObject({ kind: "registered", canCancel: false });
    });

    it("can no longer be cancelled once the server said CANCELLATION_CLOSED (its clock wins)", () => {
      expect(
        stateOf({
          standing: standing(registration()),
          cancelError: conflict("CANCELLATION_CLOSED"),
        }),
      ).toMatchObject({ kind: "registered", canCancel: false });
    });

    it("shows checked in when the server refused the cancel with ALREADY_CHECKED_IN", () => {
      const reg = registration();
      expect(
        stateOf({
          standing: standing(reg),
          cancelError: conflict("ALREADY_CHECKED_IN"),
        }),
      ).toEqual({ kind: "checked_in", registration: reg });
    });

    it("stays registered (not cancellable) after the event ended", () => {
      expect(
        stateOf({
          standing: standing(registration()),
          now: new Date("2026-12-06T00:00:00.000Z"),
        }),
      ).toMatchObject({ kind: "registered", canCancel: false });
    });

    it("keeps the speaker's complimentary ticket", () => {
      const reg = registration({ reason: "complimentary_speaker" });
      expect(
        stateOf({
          event: event({ ticketPrice: 150000 }),
          standing: standing(reg),
        }),
      ).toMatchObject({ kind: "registered", registration: reg });
    });

    it("is not changed by a busy server (503) when cancelling", () => {
      expect(
        stateOf({
          standing: standing(registration()),
          cancelError: new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
        }),
      ).toMatchObject({ kind: "registered", canCancel: true });
    });
  });

  describe("not registered: can they register?", () => {
    it("is open, with the closing time", () => {
      expect(stateOf()).toEqual({
        kind: "open",
        closesAt: "2026-12-02T12:30:00.000Z",
        paid: false,
        cancelledBefore: false,
      });
    });

    it("offers 'register again' after a cancelled registration", () => {
      expect(
        stateOf({ standing: standing(registration({ status: "cancelled" })) }),
      ).toMatchObject({ kind: "open", cancelledBefore: true });
    });

    it("has ended (at the very end moment too)", () => {
      expect(stateOf({ now: new Date("2026-12-05T12:30:00.000Z") })).toEqual({
        kind: "event_ended",
      });
    });

    it("has ended when the server says so, whatever the page's clock says", () => {
      expect(stateOf({ registerError: conflict("EVENT_ENDED") })).toEqual({
        kind: "event_ended",
      });
    });

    it("is not open yet before the opening time", () => {
      expect(stateOf({ now: new Date("2026-10-31T00:00:00.000Z") })).toEqual({
        kind: "not_open",
        opensAt: "2026-11-01T04:30:00.000Z",
        cancelledBefore: false,
      });
    });

    it("is open at the very opening moment", () => {
      expect(
        stateOf({ now: new Date("2026-11-01T04:30:00.000Z") }),
      ).toMatchObject({ kind: "open" });
    });

    it("is open from the start when no opening time is set", () => {
      expect(
        stateOf({
          event: event({ registrationOpensAt: null }),
          now: new Date("2020-01-01T00:00:00.000Z"),
        }),
      ).toMatchObject({ kind: "open" });
    });

    it("is not open when the server says REGISTRATION_NOT_OPEN", () => {
      expect(
        stateOf({ registerError: conflict("REGISTRATION_NOT_OPEN") }),
      ).toMatchObject({ kind: "not_open" });
    });

    it("is closed after the closing time", () => {
      expect(stateOf({ now: new Date("2026-12-02T13:00:00.000Z") })).toEqual({
        kind: "closed",
        closedAt: "2026-12-02T12:30:00.000Z",
        cancelledBefore: false,
      });
    });

    it("is closed once the event started when no closing time is set (event still running)", () => {
      expect(
        stateOf({
          event: event({ registrationClosesAt: null }),
          now: new Date("2026-12-04T00:00:00.000Z"),
        }),
      ).toEqual({
        kind: "closed",
        closedAt: "2026-12-03T03:30:00.000Z",
        cancelledBefore: false,
      });
    });

    it("is closed when the server says REGISTRATION_CLOSED", () => {
      expect(
        stateOf({ registerError: conflict("REGISTRATION_CLOSED") }),
      ).toMatchObject({ kind: "closed" });
    });

    it("is full with no seats left", () => {
      expect(stateOf({ event: event({ seatsLeft: 0 }) })).toEqual({
        kind: "full",
        cancelledBefore: false,
      });
    });

    it("is full when the server says EVENT_FULL, though the page still showed seats", () => {
      expect(stateOf({ registerError: conflict("EVENT_FULL") })).toMatchObject({
        kind: "full",
      });
    });

    it("is open with no seat limit (seatsLeft null)", () => {
      expect(stateOf({ event: event({ seatsLeft: null }) })).toMatchObject({
        kind: "open",
      });
    });

    it("still offers a paid event (a speaker gets in free), marked paid", () => {
      expect(stateOf({ event: event({ ticketPrice: 150000 }) })).toMatchObject({
        kind: "open",
        paid: true,
      });
    });

    it("says paid tickets are not available when the server says so", () => {
      expect(
        stateOf({
          event: event({ ticketPrice: 150000 }),
          registerError: conflict("PAYMENT_NOT_AVAILABLE_YET"),
        }),
      ).toEqual({ kind: "paid_unavailable", cancelledBefore: false });
    });

    it("keeps 'you cancelled before' on the blocked states", () => {
      expect(
        stateOf({
          event: event({ seatsLeft: 0 }),
          standing: standing(registration({ status: "cancelled" })),
        }),
      ).toEqual({ kind: "full", cancelledBefore: true });
    });
  });

  describe("checks run in the server's order", () => {
    it("ended beats not-open, closed and full", () => {
      expect(
        stateOf({
          event: event({ seatsLeft: 0 }),
          registerError: conflict("REGISTRATION_NOT_OPEN"),
          now: new Date("2027-01-01T00:00:00.000Z"),
        }),
      ).toEqual({ kind: "event_ended" });
    });

    it("not-open beats full", () => {
      expect(
        stateOf({
          event: event({ seatsLeft: 0 }),
          now: new Date("2026-10-01T00:00:00.000Z"),
        }),
      ).toMatchObject({ kind: "not_open" });
    });

    it("closed beats full", () => {
      expect(
        stateOf({
          event: event({ seatsLeft: 0 }),
          now: new Date("2026-12-02T13:00:00.000Z"),
        }),
      ).toMatchObject({ kind: "closed" });
    });
  });

  describe("errors that do not change the state", () => {
    it.each([
      new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
      new ApiError(429, "RATE_LIMITED", "slow down"),
      new ApiError(0, "NETWORK_ERROR", "offline"),
      conflict("ALREADY_REGISTERED"),
      // A conflict code only counts on a 409.
      new ApiError(400, "EVENT_FULL", "not a conflict"),
    ])("%s keeps the card open", (registerError) => {
      expect(stateOf({ registerError })).toMatchObject({ kind: "open" });
    });
  });
});

describe("registrationFailureMessage", () => {
  it("is null without an error", () => {
    expect(registrationFailureMessage(null)).toBeNull();
  });

  it.each([
    "EVENT_FULL",
    "EVENT_ENDED",
    "REGISTRATION_CLOSED",
    "REGISTRATION_NOT_OPEN",
    "PAYMENT_NOT_AVAILABLE_YET",
    "EVENT_CANCELLED",
    "CANCELLATION_CLOSED",
    "ALREADY_CHECKED_IN",
    "ALREADY_REGISTERED",
  ])("is null for %s: the card's state already says it", (code) => {
    expect(registrationFailureMessage(conflict(code))).toBeNull();
  });

  it.each([
    [new ApiError(429, "RATE_LIMITED", ""), /too often/],
    [new ApiError(0, "NETWORK_ERROR", ""), /reach the server/],
    [conflict("REGISTRATION_CHANGED"), /changed while we were cancelling/],
    [new ApiError(401, "UNAUTHENTICATED", ""), /Sign in again/],
    [new ApiError(404, "NOT_FOUND", ""), /refreshed/],
    [new ApiError(503, "SERVICE_UNAVAILABLE", ""), /busy/],
    [new ApiError(200, "INVALID_RESPONSE", ""), /busy/],
  ])("explains %s", (error, message) => {
    expect(registrationFailureMessage(error)).toMatch(message);
  });
});
