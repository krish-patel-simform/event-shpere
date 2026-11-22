import type { AttendeeDto } from "../../schemas/attendees.schemas";
import {
  attendeeStatus,
  averageBookings,
  checkedInByLine,
  checkedInPercent,
  eventDays,
  isFilteringAttendees,
  sessionSeatStatus,
} from "../attendee-display";

describe("attendeeStatus (three colours, so they can be told apart)", () => {
  const base: AttendeeDto = {
    registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya@example.com",
    ticketCode: "ESEVT1Y6D4S",
    status: "registered",
    registeredAt: "2026-11-02T08:49:00.000Z",
    checkedInAt: null,
    checkedInBy: null,
    checkInMethod: null,
  };

  it("registered, not checked in: blue Registered", () => {
    expect(attendeeStatus(base)).toEqual({
      label: "Registered",
      tone: "brand",
    });
  });

  it("checked in: green Checked in", () => {
    expect(
      attendeeStatus({ ...base, checkedInAt: "2026-12-04T04:11:00.000Z" }),
    ).toEqual({ label: "Checked in", tone: "success" });
  });

  it("cancelled: red Cancelled, even with an old check-in", () => {
    expect(
      attendeeStatus({
        ...base,
        status: "cancelled",
        checkedInAt: "2026-12-04T04:11:00.000Z",
      }),
    ).toEqual({ label: "Cancelled", tone: "danger" });
  });
});

describe("sessionSeatStatus (a session's seat, same three colours)", () => {
  it.each([
    [
      { status: "registered" as const, checkedInAt: null },
      "Registered",
      "brand",
    ],
    [
      {
        status: "registered" as const,
        checkedInAt: "2026-12-03T04:28:00.000Z",
      },
      "Checked in",
      "success",
    ],
    [
      // A session cancelled half-way cancels its seats but keeps the check-ins.
      { status: "cancelled" as const, checkedInAt: "2026-12-03T04:28:00.000Z" },
      "Cancelled",
      "danger",
    ],
  ])("%o is %s (%s)", (seat, label, tone) => {
    expect(sessionSeatStatus(seat)).toEqual({ label, tone });
  });
});

describe("averageBookings", () => {
  it.each([
    [1286, 480, "2.7"],
    [0, 480, "0.0"],
    [5, 0, "0"],
  ])("%i over %i is %s", (bookings, registered, label) => {
    expect(averageBookings(bookings, registered)).toBe(label);
  });
});

describe("eventDays (the days route 5's `date` takes, in the event's zone)", () => {
  it("lists every day of a three-day event", () => {
    // 3 Dec 09:00 IST – 5 Dec 18:00 IST.
    expect(
      eventDays(
        "2026-12-03T03:30:00.000Z",
        "2026-12-05T12:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toEqual([
      { key: "2026-12-03", label: "Thu 3 Dec" },
      { key: "2026-12-04", label: "Fri 4 Dec" },
      { key: "2026-12-05", label: "Sat 5 Dec" },
    ]);
  });

  it("has one day for a one-day event (the picker is then hidden)", () => {
    expect(
      eventDays(
        "2026-12-03T03:30:00.000Z",
        "2026-12-03T12:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toHaveLength(1);
  });

  it("uses the event's days, not UTC's: 20:00 UTC on the 2nd is the 3rd in India", () => {
    expect(
      eventDays(
        "2026-12-02T20:00:00.000Z",
        "2026-12-03T10:00:00.000Z",
        "Asia/Kolkata",
      ).map((day) => day.key),
    ).toEqual(["2026-12-03"]);
  });

  it("crosses a month and a year end", () => {
    expect(
      eventDays(
        "2026-12-31T04:00:00.000Z",
        "2027-01-01T12:00:00.000Z",
        "Asia/Kolkata",
      ).map((day) => day.key),
    ).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it("shows an overnight event (22:00 → 02:00) as ONE day, not a fake day 2", () => {
    expect(
      eventDays(
        "2026-12-03T16:30:00.000Z",
        "2026-12-03T20:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toEqual([{ key: "2026-12-03", label: "Thu 3 Dec" }]);
  });
});

describe("isFilteringAttendees", () => {
  const none = { search: "", status: "all", checkedIn: "all" } as const;

  it("is false with no filter (an empty list means nobody registered)", () => {
    expect(isFilteringAttendees(none)).toBe(false);
  });

  it("ignores a search of only spaces", () => {
    expect(isFilteringAttendees({ ...none, search: "   " })).toBe(false);
  });

  it.each([
    { search: "priya" },
    { status: "cancelled" as const },
    { checkedIn: "no" as const },
  ])("is true for %o", (filter) => {
    expect(isFilteringAttendees({ ...none, ...filter })).toBe(true);
  });
});

describe("checkedInPercent", () => {
  it.each([
    [213, 480, "44%"],
    [0, 480, "0%"],
    [480, 480, "100%"],
    [0, 0, "0%"],
  ])("%i of %i is %s", (checkedIn, registered, label) => {
    expect(checkedInPercent(checkedIn, registered)).toBe(label);
  });
});

describe("checkedInByLine", () => {
  const attendee = (overrides: Partial<AttendeeDto> = {}): AttendeeDto => ({
    registrationId: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya@example.com",
    ticketCode: "ESEVT1Y6D4S",
    status: "registered",
    registeredAt: "2026-11-02T08:49:00.000Z",
    checkedInAt: "2026-12-04T04:11:00.000Z",
    checkedInBy: { firstName: "Omkar", lastName: "Patil" },
    checkInMethod: "manual",
    ...overrides,
  });

  it("names who checked them in and how", () => {
    expect(checkedInByLine(attendee())).toBe("by Omkar Patil · manual");
    expect(checkedInByLine(attendee({ checkInMethod: "qr_scan" }))).toBe(
      "by Omkar Patil · QR scan",
    );
  });

  it("says only how when no staff member was recorded", () => {
    expect(checkedInByLine(attendee({ checkedInBy: null }))).toBe("manual");
  });

  it("is null when there is nothing to say", () => {
    expect(
      checkedInByLine(attendee({ checkedInBy: null, checkInMethod: null })),
    ).toBeNull();
  });
});
