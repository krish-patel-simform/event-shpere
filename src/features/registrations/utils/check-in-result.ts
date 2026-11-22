import { ApiError } from "../../../core/api-client/base-api.service";
import { zonedParts } from "../../../core/format/format-zoned";
import {
  alreadyCheckedInDetailsSchema,
  type AlreadyCheckedInDetails,
} from "../schemas/check-ins.schemas";

// What the door screen says after each ticket code. The answer decides whether the person goes
// in, so every code gets one plain row: green = let them in, amber = they were already let in /
// come back later, red = do not let them in. A row reads left to right: WHO (big), the ANSWER,
// and WHEN (the time the API gave, if any).

/** The person on a ticket, as routes 6 and 11 answer it. */
export type CheckInAttendee = {
  firstName: string;
  lastName: string;
  ticketCode: string;
};

/**
 * The answer to one check-in. `ok: false` carries the HTTP status and the error code (null when
 * the server could not be reached: status 0), and the server's message. `already` = who and since
 * when, on a 409 ALREADY_CHECKED_IN that said so.
 */
export type CheckInOutcome =
  | { ok: true; attendee: CheckInAttendee; checkedInAt: string }
  | {
      ok: false;
      status: number;
      code: string | null;
      message: string;
      already?: AlreadyCheckedInDetails;
    };

/** Which door, and what the staff had picked when they pressed Enter. */
export type CheckInContext =
  | {
      door: "event";
      /** "2026-12-08": what is sent. */
      date: string;
      /** "Tue 8 Dec": what the row's day chip says. */
      dayLabel: string;
      /** "Day 8 of 31" (null on a one-day event). */
      dayOfLabel: string | null;
    }
  | { door: "session"; place: string | null };

export type CheckInResultTone = "success" | "warning" | "danger";

/** The right side of a row: a check-in time the API gave. */
export type CheckInWhen = {
  /** "Checked in at" / "First checked in at". */
  label: string;
  /** "10:17", in the event's zone. */
  time: string;
  /** "Sun 22 Nov 2026". */
  date: string;
};

export type CheckInResult = {
  tone: CheckInResultTone;
  /**
   * The left side: who the ticket belongs to, when the API said (a check-in, or an "already
   * checked in" with its details). null = only the typed code is known.
   */
  person: { name: string; ticketCode: string } | null;
  /** The middle: the answer, short ("Checked in", "Already checked in for this day"). */
  title: string;
  /** Under the answer: what to do or why. */
  detail: string;
  /**
   * What the row was checked FOR, shown as a chip: "Tue 8 Dec · Day 8 of 31" at the event door,
   * the place at a session door (null when there is nothing to say).
   */
  chip: string | null;
  /** The right side; null when the API gave no time (any refusal but "already checked in"). */
  when: CheckInWhen | null;
  /**
   * The code was NOT checked (no answer, too fast, logged out): "Try again" sends it again. A
   * real answer (not found, cancelled, already in) is final: sending it again changes nothing.
   */
  retryable: boolean;
  /**
   * After how long the row closes by itself, or null to stay until closed. Only a let-them-in
   * (green) or a plain notice (amber) goes away; a "don't let them in" (red) or a row that needs
   * Try again stays, so it cannot vanish while the staff look away.
   */
  autoCloseMs: number | null;
  /** The session door's "check them in at the event door first": the page links there. */
  needsEventDoor?: true;
};

/** How long a green row stays. */
export const SUCCESS_AUTO_CLOSE_MS = 6_000;
/** How long an amber (final) row stays: longer, it has more to read. */
export const WARNING_AUTO_CLOSE_MS = 12_000;

const person = (attendee: CheckInAttendee) => ({
  name: `${attendee.firstName} ${attendee.lastName}`,
  ticketCode: attendee.ticketCode,
});

/** The chip of a row: the day at the event door, the place at a session door. */
function chipFor(context: CheckInContext): string | null {
  if (context.door === "session") return context.place;
  return context.dayOfLabel
    ? `${context.dayLabel} · ${context.dayOfLabel}`
    : context.dayLabel;
}

/** A time from the API, split for the row's right side, in the event's zone. */
function whenOf(label: string, iso: string, timezone: string): CheckInWhen {
  const p = zonedParts(iso, timezone);
  return {
    label,
    time: `${p.hour}:${p.minute}`,
    date: `${p.weekday} ${p.day} ${p.month} ${p.year}`,
  };
}

/** The row for one answer. `timezone` = the event's, for the time of a check-in. */
export function checkInResult(
  outcome: CheckInOutcome,
  context: CheckInContext,
  timezone: string,
): CheckInResult {
  const session = context.door === "session";
  const chip = chipFor(context);

  if (outcome.ok) {
    return {
      tone: "success",
      person: person(outcome.attendee),
      title: session ? "Checked in to this session" : "Checked in",
      detail: "Let them in. Next person, please.",
      chip,
      when: whenOf("Checked in at", outcome.checkedInAt, timezone),
      retryable: false,
      autoCloseMs: SUCCESS_AUTO_CLOSE_MS,
    };
  }

  const final = (
    tone: CheckInResultTone,
    title: string,
    detail: string,
  ): CheckInResult => ({
    tone,
    person: null,
    title,
    detail,
    chip,
    when: null,
    retryable: false,
    autoCloseMs: tone === "warning" ? WARNING_AUTO_CLOSE_MS : null,
  });
  const retry = (
    tone: CheckInResultTone,
    title: string,
    detail: string,
  ): CheckInResult => ({
    tone,
    person: null,
    title,
    detail,
    chip,
    when: null,
    retryable: true,
    autoCloseMs: null,
  });

  switch (outcome.code) {
    case "REGISTRATION_CANCELLED":
      return final(
        "danger",
        "This ticket was cancelled",
        "Its registration was cancelled. Send them to registration if seats are left.",
      );
    case "ALREADY_CHECKED_IN": {
      const already = outcome.already;
      return {
        ...final(
          "warning",
          session
            ? "Already checked in to this session"
            : "Already checked in for this day",
          session
            ? "A seat is checked in once."
            : "Each person checks in once per event day.",
        ),
        person: already ? person(already.attendee) : null,
        when: already
          ? whenOf("First checked in at", already.checkedInAt, timezone)
          : null,
      };
    }
    case "CHECK_IN_NOT_OPEN":
      return final(
        "warning",
        session
          ? "Session check-in is not open yet"
          : "Check-in is not open yet",
        outcome.message,
      );
    case "CHECK_IN_CLOSED":
      return final(
        "warning",
        session ? "Session check-in is closed" : "Check-in is closed",
        outcome.message,
      );
    case "NOT_AN_EVENT_DAY":
      return final("warning", "Not a day of this event", outcome.message);
    case "EVENT_CANCELLED":
      return final(
        "danger",
        "This event was cancelled",
        "Nobody can be checked in.",
      );
    case "EVENT_NOT_PUBLISHED":
      return final(
        "danger",
        "This event is still a draft",
        "Publish the event before checking people in.",
      );
    case "SESSION_CANCELLED":
      return final(
        "danger",
        "This session was cancelled",
        "Its seats were released.",
      );
    case "SESSION_NOT_BOOKED":
      return final(
        "danger",
        "No seat in this session",
        "This person did not book this session. Walk-ins are not recorded.",
      );
    case "EVENT_CHECK_IN_REQUIRED":
      return {
        ...final(
          "danger",
          "Check them in at the event door first",
          "This person has not checked in at the event for this day.",
        ),
        needsEventDoor: true,
      };
    case "RATE_LIMITED":
      return retry(
        "warning",
        "Slow down a little",
        "You are checking in very quickly. This code was not checked: wait a few seconds and try again.",
      );
  }

  if (outcome.status === 404) {
    return final(
      "danger",
      "Ticket not found",
      "No ticket with this code for this event. Check the code.",
    );
  }
  if (outcome.status === 400) {
    return final("danger", "Check the ticket code", outcome.message);
  }
  if (outcome.status === 401) {
    return retry(
      "danger",
      "You are logged out",
      "Log in again, then try this code again. It was not checked.",
    );
  }
  if (outcome.status === 403) {
    return final(
      "danger",
      "You can't check people in here",
      "Your account may not check people in for this event.",
    );
  }
  // An answer that came back 2xx but could not be read: the check-in most likely WORKED.
  if (outcome.status >= 200 && outcome.status < 300) {
    return retry(
      "warning",
      "We couldn't read the answer",
      "The check-in probably went through. Try again to be sure: it will say they are already checked in.",
    );
  }
  // No answer (status 0: offline or a timeout), a 5xx, or a code this screen does not know. A
  // timeout may still have reached the server, so do not claim either way: Try again tells.
  return retry(
    "danger",
    "We couldn't check this ticket",
    "No clear answer from the server, so don't let them in yet. Try again: if it went through, it will say they are already checked in.",
  );
}

/**
 * What a failed check-in request becomes. The API client throws an ApiError (status 0 when the
 * server could not be reached); anything else thrown is treated as no answer. An "already checked
 * in" keeps who and since when, if its details read right (otherwise the row is just less
 * specific).
 */
export function toCheckInFailure(error: unknown): CheckInOutcome {
  if (error instanceof ApiError) {
    const already =
      error.code === "ALREADY_CHECKED_IN"
        ? alreadyCheckedInDetailsSchema.safeParse(error.details)
        : null;
    return {
      ok: false,
      status: error.status,
      code: error.code,
      message: error.message,
      ...(already?.success && { already: already.data }),
    };
  }
  return { ok: false, status: 0, code: null, message: "No answer" };
}

/** A ticket code as the server reads it: trimmed and upper-cased, 1 to 32 characters. */
export const TICKET_CODE_MAX_LENGTH = 32;

/** The code to send, or null when it is empty or too long (the form shows a hint instead). */
export function normalizeTicketCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return code.length >= 1 && code.length <= TICKET_CODE_MAX_LENGTH
    ? code
    : null;
}
