import type { ApiError } from "../../../core/api-client/base-api.service";
import { zonedDayKey } from "../../../core/format/format-zoned";
import type { MyTicketDto } from "../schemas/registrations.schemas";
import { isPast } from "./api-conflict";
import {
  registrationClosesAt,
  registrationFailureMessage,
} from "./registration-card-state";

/** Every look of one "My tickets" card (design board "My tickets"). */
export type MyTicketState =
  /** The organizer cancelled the event: the registration and seats were cancelled with it. */
  | { kind: "event_cancelled" }
  /** The user cancelled. They may register again while the event has not ended. */
  | { kind: "cancelled"; canRegisterAgain: boolean }
  | {
      kind: "registered";
      /** "In 13 days", "Tomorrow", "Today", "Happening now", "Ended". */
      when: string;
      /** Until registration closes (or the event starts); after that the server says no. */
      canCancel: boolean;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `now` to the event's first day, both in the event's zone. */
function daysUntil(startAt: string, timezone: string, now: Date): number {
  const start = Date.parse(zonedDayKey(startAt, timezone));
  const today = Date.parse(zonedDayKey(now, timezone));
  return Math.round((start - today) / DAY_MS);
}

/** How far away the event is, in the words of the card. */
export function relativeEventDay(
  event: Pick<MyTicketDto["event"], "startAt" | "endAt" | "timezone">,
  now: Date,
): string {
  if (isPast(event.endAt, now)) return "Ended";
  if (isPast(event.startAt, now)) return "Happening now";
  const days = daysUntil(event.startAt, event.timezone, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Works out what one ticket card shows. */
export function myTicketState(ticket: MyTicketDto, now: Date): MyTicketState {
  const { registration, event } = ticket;
  // A cancelled event cancelled every registration with it: say why, whatever the row says.
  if (event.status === "cancelled") return { kind: "event_cancelled" };
  if (registration.status !== "registered") {
    return { kind: "cancelled", canRegisterAgain: !isPast(event.endAt, now) };
  }
  return {
    kind: "registered",
    when: relativeEventDay(event, now),
    canCancel: !isPast(registrationClosesAt(event), now),
  };
}

/** "3 sessions booked", "1 session booked" or "No sessions booked yet". */
export function bookedSessionsLabel(count: number): string {
  if (count === 0) return "No sessions booked yet";
  return count === 1 ? "1 session booked" : `${count} sessions booked`;
}

/**
 * Why a cancel from "My tickets" failed. `final` = trying again cannot work (the window closed,
 * the ticket was used, it is already gone), so the dialog offers only "Close".
 */
export function ticketCancelFailure(
  error: ApiError | null,
): { message: string; final: boolean } | null {
  if (!error) return null;
  if (error.status === 409 && error.code === "CANCELLATION_CLOSED") {
    return {
      message:
        "Registration for this event has closed, so this ticket can no longer be cancelled. Contact the organiser if you cannot attend.",
      final: true,
    };
  }
  if (error.status === 409 && error.code === "ALREADY_CHECKED_IN") {
    return {
      message:
        "You are checked in, so this registration can no longer be cancelled.",
      final: true,
    };
  }
  if (error.status === 404) {
    return {
      message:
        "This registration is no longer there. The list has been refreshed.",
      final: true,
    };
  }
  return {
    message:
      registrationFailureMessage(error) ??
      "The service is busy. Wait a moment and try again.",
    final: false,
  };
}
