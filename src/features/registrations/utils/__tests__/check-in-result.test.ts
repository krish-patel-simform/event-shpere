import { ApiError } from "../../../../core/api-client/base-api.service";
import {
  checkInResult,
  normalizeTicketCode,
  SUCCESS_AUTO_CLOSE_MS,
  toCheckInFailure,
  WARNING_AUTO_CLOSE_MS,
  type CheckInContext,
  type CheckInOutcome,
} from "../check-in-result";

const TZ = "Asia/Kolkata";
const eventDoor: CheckInContext = {
  door: "event",
  date: "2026-12-04",
  dayLabel: "Fri 4 Dec",
  dayOfLabel: "Day 2 of 3",
};
const oneDayDoor: CheckInContext = {
  door: "event",
  date: "2026-12-04",
  dayLabel: "Fri 4 Dec",
  dayOfLabel: null,
};
const sessionDoor: CheckInContext = { door: "session", place: "Hall B" };

const failed = (
  status: number,
  code: string | null,
  message = "Server message",
): CheckInOutcome => ({ ok: false, status, code, message });

const priya = {
  firstName: "Priya",
  lastName: "Shah",
  ticketCode: "ESEVT1Y6D4S",
};

describe("checkInResult: a check-in that worked (green: let them in)", () => {
  const ok: CheckInOutcome = {
    ok: true,
    attendee: priya,
    // 4 Dec 09:41 IST.
    checkedInAt: "2026-12-04T04:11:00.000Z",
  };

  it("left: the person and ticket; middle: the answer; right: the time in the event's zone", () => {
    expect(checkInResult(ok, eventDoor, TZ)).toEqual({
      tone: "success",
      person: { name: "Priya Shah", ticketCode: "ESEVT1Y6D4S" },
      title: "Checked in",
      detail: "Let them in. Next person, please.",
      chip: "Fri 4 Dec · Day 2 of 3",
      when: { label: "Checked in at", time: "09:41", date: "Fri 4 Dec 2026" },
      retryable: false,
      autoCloseMs: SUCCESS_AUTO_CLOSE_MS,
    });
  });

  it("a one-day event's chip is just the date", () => {
    expect(checkInResult(ok, oneDayDoor, TZ).chip).toBe("Fri 4 Dec");
  });

  it("at a session says 'to this session' and the chip is the place", () => {
    const result = checkInResult(ok, sessionDoor, TZ);

    expect(result.title).toBe("Checked in to this session");
    expect(result.person?.name).toBe("Priya Shah");
    expect(result.chip).toBe("Hall B");
  });

  it("a session with no place has no chip", () => {
    expect(
      checkInResult(ok, { door: "session", place: null }, TZ).chip,
    ).toBeNull();
  });
});

describe("checkInResult: already checked in (amber)", () => {
  const already: CheckInOutcome = {
    ok: false,
    status: 409,
    code: "ALREADY_CHECKED_IN",
    message: "Priya Shah is already checked in today",
    // First checked in 4 Dec 09:41 IST.
    already: { attendee: priya, checkedInAt: "2026-12-04T04:11:00.000Z" },
  };

  it("at the event door: who, the answer, the day, and when they FIRST came in", () => {
    expect(checkInResult(already, eventDoor, TZ)).toMatchObject({
      tone: "warning",
      person: { name: "Priya Shah", ticketCode: "ESEVT1Y6D4S" },
      title: "Already checked in for this day",
      detail: "Each person checks in once per event day.",
      chip: "Fri 4 Dec · Day 2 of 3",
      when: {
        label: "First checked in at",
        time: "09:41",
        date: "Fri 4 Dec 2026",
      },
      retryable: false,
    });
  });

  it("at a session door says a seat is checked in once", () => {
    expect(checkInResult(already, sessionDoor, TZ)).toMatchObject({
      person: { name: "Priya Shah" },
      title: "Already checked in to this session",
      detail: "A seat is checked in once.",
    });
  });

  it("still says it plainly when the details did not come: no person, no time", () => {
    expect(
      checkInResult(failed(409, "ALREADY_CHECKED_IN"), eventDoor, TZ),
    ).toMatchObject({
      person: null,
      title: "Already checked in for this day",
      detail: "Each person checks in once per event day.",
      when: null,
    });
  });

  it("a refusal other than 'already checked in' names nobody and has no time", () => {
    expect(
      checkInResult(failed(404, "NOT_FOUND"), eventDoor, TZ),
    ).toMatchObject({ person: null, when: null });
  });
});

describe("checkInResult: which rows close by themselves", () => {
  it("green and final amber rows close after a while (amber stays longer)", () => {
    expect(WARNING_AUTO_CLOSE_MS).toBeGreaterThan(SUCCESS_AUTO_CLOSE_MS);
    expect(
      checkInResult(failed(409, "ALREADY_CHECKED_IN"), eventDoor, TZ)
        .autoCloseMs,
    ).toBe(WARNING_AUTO_CLOSE_MS);
    expect(
      checkInResult(failed(409, "CHECK_IN_CLOSED"), eventDoor, TZ).autoCloseMs,
    ).toBe(WARNING_AUTO_CLOSE_MS);
  });

  it.each([
    [404, "NOT_FOUND"],
    [409, "REGISTRATION_CANCELLED"],
    [409, "EVENT_CHECK_IN_REQUIRED"],
  ])("a red 'do not let them in' row stays (%i %s)", (status, code) => {
    expect(
      checkInResult(failed(status, code), sessionDoor, TZ).autoCloseMs,
    ).toBeNull();
  });

  it.each([
    [429, "RATE_LIMITED"],
    [0, null],
    [200, "INVALID_RESPONSE"],
  ])(
    "a row that needs Try again stays, even an amber one (%i %s)",
    (status, code) => {
      expect(
        checkInResult(failed(status, code), eventDoor, TZ).autoCloseMs,
      ).toBeNull();
    },
  );

  it("every row carries the door's chip, also a failed one", () => {
    expect(checkInResult(failed(404, "NOT_FOUND"), eventDoor, TZ).chip).toBe(
      "Fri 4 Dec · Day 2 of 3",
    );
  });
});

describe("checkInResult: answers that are final (sending again changes nothing)", () => {
  it.each([
    [404, "NOT_FOUND", "Ticket not found", "danger"],
    [409, "REGISTRATION_CANCELLED", "This ticket was cancelled", "danger"],
    [409, "CHECK_IN_NOT_OPEN", "Check-in is not open yet", "warning"],
    [409, "CHECK_IN_CLOSED", "Check-in is closed", "warning"],
    [409, "NOT_AN_EVENT_DAY", "Not a day of this event", "warning"],
    [409, "EVENT_CANCELLED", "This event was cancelled", "danger"],
    [409, "EVENT_NOT_PUBLISHED", "This event is still a draft", "danger"],
    [400, "VALIDATION_ERROR", "Check the ticket code", "danger"],
    [403, "FORBIDDEN", "You can't check people in here", "danger"],
  ])("event door %i %s: %s (%s)", (status, code, title, tone) => {
    const result = checkInResult(failed(status, code), eventDoor, TZ);

    expect(result).toMatchObject({ title, tone, retryable: false });
  });

  it.each([
    ["SESSION_NOT_BOOKED", "No seat in this session"],
    ["SESSION_CANCELLED", "This session was cancelled"],
    ["CHECK_IN_NOT_OPEN", "Session check-in is not open yet"],
    ["CHECK_IN_CLOSED", "Session check-in is closed"],
  ])("session door %s: %s", (code, title) => {
    expect(checkInResult(failed(409, code), sessionDoor, TZ)).toMatchObject({
      title,
      retryable: false,
    });
  });

  it("sends the session door's 'not at the event door yet' to the event door", () => {
    expect(
      checkInResult(failed(409, "EVENT_CHECK_IN_REQUIRED"), sessionDoor, TZ),
    ).toMatchObject({
      title: "Check them in at the event door first",
      needsEventDoor: true,
      retryable: false,
    });
  });

  it("shows the server's own words for a closed or not-open window (they name the day)", () => {
    const message =
      "Check-in for 2026-12-05 opens 6 hours before that day starts";

    expect(
      checkInResult(failed(409, "CHECK_IN_NOT_OPEN", message), eventDoor, TZ)
        .detail,
    ).toBe(message);
  });
});

describe("checkInResult: the code was NOT checked (Try again)", () => {
  it.each([
    [429, "RATE_LIMITED", "Slow down a little"],
    [0, null, "We couldn't check this ticket"],
    [503, null, "We couldn't check this ticket"],
    [500, "INTERNAL", "We couldn't check this ticket"],
    [401, "UNAUTHENTICATED", "You are logged out"],
  ])("%i %s: %s", (status, code, title) => {
    expect(checkInResult(failed(status, code), eventDoor, TZ)).toMatchObject({
      title,
      retryable: true,
    });
  });

  it("does not claim either way when nothing came back (a timeout may have reached the server)", () => {
    const { detail } = checkInResult(failed(0, null), eventDoor, TZ);

    expect(detail).toMatch(/don't let them in yet/);
    expect(detail).toMatch(/already checked in/);
  });

  it("says the check-in probably worked when the answer came back 2xx but could not be read", () => {
    expect(
      checkInResult(failed(200, "INVALID_RESPONSE"), eventDoor, TZ),
    ).toMatchObject({
      tone: "warning",
      title: "We couldn't read the answer",
      retryable: true,
    });
  });

  it("treats a 409 code it does not know as not checked, not as a pass", () => {
    expect(
      checkInResult(failed(409, "SOMETHING_NEW"), eventDoor, TZ),
    ).toMatchObject({ tone: "danger", retryable: true });
  });
});

describe("toCheckInFailure", () => {
  it("keeps the API error's status, code and message", () => {
    expect(
      toCheckInFailure(new ApiError(409, "ALREADY_CHECKED_IN", "Already")),
    ).toEqual({
      ok: false,
      status: 409,
      code: "ALREADY_CHECKED_IN",
      message: "Already",
    });
  });

  it("keeps who and since when from an ALREADY_CHECKED_IN's details", () => {
    const details = {
      attendee: priya,
      checkedInAt: "2026-12-04T04:11:00.000Z",
    };

    expect(
      toCheckInFailure(
        new ApiError(409, "ALREADY_CHECKED_IN", "Already", {}, details),
      ),
    ).toEqual({
      ok: false,
      status: 409,
      code: "ALREADY_CHECKED_IN",
      message: "Already",
      already: details,
    });
  });

  it("drops details that do not read right, and never reads them for another code", () => {
    expect(
      toCheckInFailure(
        new ApiError(
          409,
          "ALREADY_CHECKED_IN",
          "Already",
          {},
          {
            attendee: { firstName: "" },
            checkedInAt: "yesterday",
          },
        ),
      ),
    ).not.toHaveProperty("already");
    expect(
      toCheckInFailure(
        new ApiError(
          409,
          "REGISTRATION_CANCELLED",
          "Cancelled",
          {},
          {
            attendee: priya,
            checkedInAt: "2026-12-04T04:11:00.000Z",
          },
        ),
      ),
    ).not.toHaveProperty("already");
  });

  it("turns anything else thrown into 'no answer' (status 0)", () => {
    expect(toCheckInFailure(new TypeError("boom"))).toEqual({
      ok: false,
      status: 0,
      code: null,
      message: "No answer",
    });
  });
});

describe("normalizeTicketCode (what the server does to a code)", () => {
  it("trims and upper-cases", () => {
    expect(normalizeTicketCode("  esevt7k3q9p ")).toBe("ESEVT7K3Q9P");
  });

  it("refuses an empty code and one over 32 characters", () => {
    expect(normalizeTicketCode("")).toBeNull();
    expect(normalizeTicketCode("   ")).toBeNull();
    expect(normalizeTicketCode("A".repeat(33))).toBeNull();
    expect(normalizeTicketCode("A".repeat(32))).toBe("A".repeat(32));
  });
});
