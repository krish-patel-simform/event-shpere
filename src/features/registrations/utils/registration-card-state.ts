import type { ApiError } from "../../../core/api-client/base-api.service";
import type {
  MyRegistrationDto,
  RegistrationDto,
} from "../schemas/registrations.schemas";
import { conflictOf, isPast } from "./api-conflict";

/** What the card needs to know about the event (a part of the public event page). */
export type RegistrationCardEvent = {
  id: string;
  status: "published" | "cancelled";
  startAt: string;
  endAt: string;
  timezone: string;
  /** Paise: 0 = free. */
  ticketPrice: number;
  /** null = no limit. */
  seatsLeft: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
};

/**
 * Who is looking. `attendee` = holds REGISTRATION_CREATE (roles user and speaker); `staff` =
 * signed in without it (organizer, admin), the API answers them 403; `unknown` = the account
 * could not be loaded (not a 401), so it is not known which.
 */
export type RegistrationViewer =
  "loading" | "guest" | "attendee" | "staff" | "unknown";

/** Every state of the card (design board "Event registration card, all states"). */
export type RegistrationCardState =
  | { kind: "loading" }
  | { kind: "account_error" }
  | { kind: "standing_error" }
  | { kind: "event_cancelled" }
  | { kind: "event_ended" }
  | { kind: "signed_out" }
  | { kind: "staff" }
  | {
      kind: "registered";
      registration: RegistrationDto;
      bookedCount: number;
      /** False once registration has closed (CANCELLATION_CLOSED). */
      canCancel: boolean;
      /** When cancelling stops: registration closing, or the event start. */
      cancelUntil: string;
    }
  | { kind: "checked_in"; registration: RegistrationDto }
  | { kind: "not_open"; opensAt: string | null; cancelledBefore: boolean }
  | { kind: "closed"; closedAt: string; cancelledBefore: boolean }
  | { kind: "paid_unavailable"; cancelledBefore: boolean }
  | { kind: "full"; cancelledBefore: boolean }
  | {
      kind: "open";
      closesAt: string;
      paid: boolean;
      /** The user cancelled before: "Register again" (a new ticket code, seats not restored). */
      cancelledBefore: boolean;
    };

/**
 * The 409 codes that say what the card should show, in place of what the page worked out from
 * its (possibly stale) data. The server is the judge: its clock and its seat count win.
 */
const REGISTER_CONFLICTS = [
  "EVENT_CANCELLED",
  "EVENT_ENDED",
  "REGISTRATION_NOT_OPEN",
  "REGISTRATION_CLOSED",
  "PAYMENT_NOT_AVAILABLE_YET",
  "EVENT_FULL",
] as const;
type RegisterConflict = (typeof REGISTER_CONFLICTS)[number];

const CANCEL_CONFLICTS = ["CANCELLATION_CLOSED", "ALREADY_CHECKED_IN"] as const;
type CancelConflict = (typeof CANCEL_CONFLICTS)[number];

/**
 * Registration closes at `registrationClosesAt`, or at the event start when none is set. It is
 * also when cancelling stops, for the registration and for every session seat of the event.
 */
export function registrationClosesAt(
  event: Pick<RegistrationCardEvent, "registrationClosesAt" | "startAt">,
): string {
  return event.registrationClosesAt ?? event.startAt;
}

export type RegistrationCardInput = {
  event: RegistrationCardEvent;
  viewer: RegistrationViewer;
  /** Route 2's answer; undefined while it loads (or when it is not asked). */
  standing: MyRegistrationDto | undefined;
  standingFailed: boolean;
  /** The last failure of route 1 / route 3, if any. */
  registerError: ApiError | null;
  cancelError: ApiError | null;
  now: Date;
};

/**
 * Works out what the registration card shows. Checks run in the same order as the server's
 * (cancelled → ended → before the window → after it → paid → full), so the card says what a
 * click would be answered with.
 */
export function registrationCardState({
  event,
  viewer,
  standing,
  standingFailed,
  registerError,
  cancelError,
  now,
}: RegistrationCardInput): RegistrationCardState {
  const registerConflict: RegisterConflict | null = conflictOf(
    registerError,
    REGISTER_CONFLICTS,
  );
  const cancelConflict: CancelConflict | null = conflictOf(
    cancelError,
    CANCEL_CONFLICTS,
  );

  // A cancelled event cancelled every registration too: nothing else matters.
  if (event.status === "cancelled" || registerConflict === "EVENT_CANCELLED") {
    return { kind: "event_cancelled" };
  }
  const ended = isPast(event.endAt, now) || registerConflict === "EVENT_ENDED";

  if (viewer === "loading") return { kind: "loading" };
  if (viewer === "unknown") return { kind: "account_error" };
  // Guests and staff cannot register at all; an ended event says so first.
  if (viewer === "guest")
    return ended ? { kind: "event_ended" } : { kind: "signed_out" };
  if (viewer === "staff")
    return ended ? { kind: "event_ended" } : { kind: "staff" };

  if (standingFailed) return { kind: "standing_error" };
  if (!standing) return { kind: "loading" };

  const { registration } = standing;
  const cancelUntil = registrationClosesAt(event);

  if (registration?.status === "registered") {
    if (cancelConflict === "ALREADY_CHECKED_IN") {
      return { kind: "checked_in", registration };
    }
    return {
      kind: "registered",
      registration,
      bookedCount: standing.bookedSessionIds.length,
      canCancel: !isPast(cancelUntil, now) && cancelConflict === null,
      cancelUntil,
    };
  }

  // Not registered (never, or cancelled): may they register now?
  const cancelledBefore = registration?.status === "cancelled";
  if (ended) return { kind: "event_ended" };

  const opensAt = event.registrationOpensAt;
  if (
    registerConflict === "REGISTRATION_NOT_OPEN" ||
    (opensAt !== null && !isPast(opensAt, now))
  ) {
    return { kind: "not_open", opensAt, cancelledBefore };
  }
  if (registerConflict === "REGISTRATION_CLOSED" || isPast(cancelUntil, now)) {
    return { kind: "closed", closedAt: cancelUntil, cancelledBefore };
  }
  if (registerConflict === "PAYMENT_NOT_AVAILABLE_YET") {
    return { kind: "paid_unavailable", cancelledBefore };
  }
  if (registerConflict === "EVENT_FULL" || event.seatsLeft === 0) {
    return { kind: "full", cancelledBefore };
  }
  return {
    kind: "open",
    closesAt: cancelUntil,
    // A paid event is still offered: a speaker of the event gets in free. Anyone else is
    // answered PAYMENT_NOT_AVAILABLE_YET until paid tickets exist.
    paid: event.ticketPrice > 0,
    cancelledBefore,
  };
}

/**
 * The message for a failure that does NOT change the card's state (429, 503, network, a guard
 * conflict): shown above the button, with "Try again". null = the state already says it all.
 */
export function registrationFailureMessage(
  error: ApiError | null,
): string | null {
  if (!error) return null;
  if (
    conflictOf(error, REGISTER_CONFLICTS) ||
    conflictOf(error, CANCEL_CONFLICTS)
  ) {
    return null;
  }
  switch (error.code) {
    case "ALREADY_REGISTERED":
      // Registered in another tab: the standing is read again and shows the ticket.
      return null;
    case "RATE_LIMITED":
      return "You are doing that too often. Wait a moment and try again.";
    case "NETWORK_ERROR":
      return "Could not reach the server. Check your connection and try again.";
    case "REGISTRATION_CHANGED":
      return "Your registration changed while we were cancelling it. Check it and try again.";
    case "UNAUTHENTICATED":
      return "Your session has ended. Sign in again to continue.";
    case "NOT_FOUND":
      return "We could not find that registration any more. The page has been refreshed.";
    default:
      return "The service is busy. Wait a moment and try again.";
  }
}
