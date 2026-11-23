import type { ApiError } from "../../../core/api-client/base-api.service";
import type { MyRegistrationDto } from "../schemas/registrations.schemas";
import { conflictOf, isPast } from "./api-conflict";
import {
  registrationClosesAt,
  registrationFailureMessage,
  type RegistrationViewer,
} from "./registration-card-state";

/** What the booking card needs to know about the session (a part of its public page). */
export type SessionBookingTarget = {
  id: string;
  /** null = not scheduled yet. */
  startAt: string | null;
  /** "in_person" | "online" | "hybrid": only an online session needs no hall. */
  mode: string;
  /** null = no hall assigned (normal for an online session). */
  hallName: string | null;
  /** false = no booking: anyone with an event ticket walks in. */
  requiresRegistration: boolean;
  /** Paise on top of the event ticket; 0 = included. */
  price: number;
  /** null = no seat limit (online) or no booking. */
  seatsLeft: number | null;
};

/** What the booking card needs to know about the session's event. */
export type SessionBookingEvent = {
  id: string;
  status: "published" | "cancelled";
  startAt: string;
  registrationClosesAt: string | null;
  timezone: string;
};

/** Every state of the card (design board "Session booking card, all states"). */
export type SessionBookingState =
  | { kind: "loading" }
  | { kind: "account_error" }
  | { kind: "standing_error" }
  | { kind: "event_cancelled" }
  | { kind: "session_cancelled" }
  | { kind: "no_booking_needed" }
  | { kind: "signed_out" }
  | { kind: "staff" }
  | {
      kind: "booked";
      /** False once event registration has closed (CANCELLATION_CLOSED). */
      canCancel: boolean;
      cancelUntil: string;
    }
  | { kind: "checked_in" }
  | { kind: "started" }
  /** Bookable later: the organizer has not set the time, or not assigned a hall yet. */
  | { kind: "opens_soon"; reason: "time" | "hall" }
  /** No live event registration: book from it. `cancelledBefore` = it was cancelled. */
  | { kind: "register_first"; cancelledBefore: boolean }
  | { kind: "speaker" }
  | { kind: "paid_unavailable" }
  | { kind: "full" }
  | {
      kind: "open";
      cancelUntil: string;
      /** Online: no hall, so no seat limit. */
      unlimited: boolean;
    };

/** 409 codes of route 8 that decide the card's state (the server's clock and seat count win). */
const BOOK_CONFLICTS = [
  "EVENT_CANCELLED",
  "SESSION_CANCELLED",
  "SESSION_NOT_BOOKABLE",
  "SESSION_STARTED",
  "EVENT_REGISTRATION_REQUIRED",
  "SPEAKER_CANNOT_BOOK",
  "PAYMENT_NOT_AVAILABLE_YET",
  "SESSION_FULL",
] as const;

/** 409 codes of route 9 that decide the card's state. */
const CANCEL_CONFLICTS = ["CANCELLATION_CLOSED", "ALREADY_CHECKED_IN"] as const;

export type SessionBookingInput = {
  session: SessionBookingTarget;
  event: SessionBookingEvent;
  viewer: RegistrationViewer;
  /** Route 2's answer for the session's event; undefined while it loads (or when not asked). */
  standing: MyRegistrationDto | undefined;
  standingFailed: boolean;
  bookError: ApiError | null;
  cancelError: ApiError | null;
  now: Date;
};

/**
 * Works out what the "Book this session" card shows. A seat the user already holds is shown
 * first (they must be able to see and cancel it); otherwise the checks run in the same order as
 * route 8's: event cancelled → session cancelled → no booking needed → started → no hall →
 * no event registration → speaker → paid → full.
 */
export function sessionBookingState({
  session,
  event,
  viewer,
  standing,
  standingFailed,
  bookError,
  cancelError,
  now,
}: SessionBookingInput): SessionBookingState {
  const bookConflict = conflictOf(bookError, BOOK_CONFLICTS);
  const cancelConflict = conflictOf(cancelError, CANCEL_CONFLICTS);

  if (event.status === "cancelled" || bookConflict === "EVENT_CANCELLED") {
    return { kind: "event_cancelled" };
  }
  if (bookConflict === "SESSION_CANCELLED")
    return { kind: "session_cancelled" };
  // Nothing to book for anyone: say so to guests and staff too.
  if (!session.requiresRegistration) return { kind: "no_booking_needed" };

  const started =
    (session.startAt !== null && isPast(session.startAt, now)) ||
    bookConflict === "SESSION_STARTED";

  if (viewer === "loading") return { kind: "loading" };
  if (viewer === "unknown") return { kind: "account_error" };
  if (viewer === "guest")
    return started ? { kind: "started" } : { kind: "signed_out" };
  if (viewer === "staff") return { kind: "staff" };

  if (standingFailed) return { kind: "standing_error" };
  if (!standing) return { kind: "loading" };

  const cancelUntil = registrationClosesAt(event);

  if (standing.bookedSessionIds.includes(session.id)) {
    if (cancelConflict === "ALREADY_CHECKED_IN") return { kind: "checked_in" };
    return {
      kind: "booked",
      canCancel: !isPast(cancelUntil, now) && cancelConflict === null,
      cancelUntil,
    };
  }

  if (started) return { kind: "started" };
  if (session.startAt === null) return { kind: "opens_soon", reason: "time" };
  if (
    (session.mode !== "online" && session.hallName === null) ||
    bookConflict === "SESSION_NOT_BOOKABLE"
  ) {
    return { kind: "opens_soon", reason: "hall" };
  }

  const { registration } = standing;
  if (
    registration?.status !== "registered" ||
    bookConflict === "EVENT_REGISTRATION_REQUIRED"
  ) {
    return {
      kind: "register_first",
      cancelledBefore: registration?.status === "cancelled",
    };
  }
  if (bookConflict === "SPEAKER_CANNOT_BOOK") return { kind: "speaker" };
  // Every paid seat is refused until paid tickets exist (a speaker cannot book at all).
  if (session.price > 0 || bookConflict === "PAYMENT_NOT_AVAILABLE_YET") {
    return { kind: "paid_unavailable" };
  }
  if (session.seatsLeft === 0 || bookConflict === "SESSION_FULL") {
    return { kind: "full" };
  }
  return { kind: "open", cancelUntil, unlimited: session.seatsLeft === null };
}

/**
 * The message for a failure that does NOT change the card's state (429, 503, network, a guard
 * conflict): shown above the button. null = the state already says it all.
 */
export function bookingFailureMessage(error: ApiError | null): string | null {
  if (!error) return null;
  if (
    conflictOf(error, BOOK_CONFLICTS) ||
    conflictOf(error, CANCEL_CONFLICTS)
  ) {
    return null;
  }
  switch (error.code) {
    case "ALREADY_BOOKED":
      // Booked in another tab: the standing is read again and shows the seat.
      return null;
    case "NOT_FOUND":
      return "This session or your seat could not be found any more. Reload the page.";
    case "BOOKING_CHANGED":
      return "Your seat changed while we were cancelling it. Check it and try again.";
    default:
      return registrationFailureMessage(error);
  }
}
