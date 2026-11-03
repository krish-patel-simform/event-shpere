import type { ManagedEvent } from "../../types/event-manage.types";
import {
  DEFAULT_EVENT_FILTERS,
  fillPercent,
  formatEventDates,
  formatEventTimes,
  formatTicketPrice,
  isEditable,
  isFiltering,
  plural,
  registrationsCell,
  sessionsCell,
  thumbDate,
  toFormDateTime,
  venueLine,
  zoneLabel,
} from "../event-display";
import {
  DESIGN_DAY_ID,
  FINTECH_ID,
  FUTURES_ID,
  MEETUP_ID,
  SAMPLE_EVENTS,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";

const IST = "Asia/Kolkata";
const byId = (id: string): ManagedEvent => {
  const event = SAMPLE_EVENTS.find((item) => item.id === id);
  if (!event) throw new Error(`no sample event ${id}`);
  return event;
};
describe("isFiltering", () => {
  it("is false for the default view", () => {
    expect(isFiltering("all", DEFAULT_EVENT_FILTERS)).toBe(false);
  });

  it("is true for another tab or a search, but not for a blank search", () => {
    expect(isFiltering("draft", DEFAULT_EVENT_FILTERS)).toBe(true);
    expect(isFiltering("all", { search: "x", sort: "soonest" })).toBe(true);
    expect(isFiltering("all", { search: "   ", sort: "soonest" })).toBe(false);
  });
});

describe("formatEventDates", () => {
  it("shows a single day once", () => {
    const e = byId(DESIGN_DAY_ID);
    expect(formatEventDates(e.startAt, e.endAt, IST)).toBe("14 Nov 2026");
  });

  it("joins days of one month", () => {
    const e = byId(SUMMIT_ID);
    expect(formatEventDates(e.startAt, e.endAt, IST)).toBe("3 – 5 Dec 2026");
  });

  it("can add the weekday", () => {
    const e = byId(SUMMIT_ID);
    expect(formatEventDates(e.startAt, e.endAt, IST, { weekday: true })).toBe(
      "Thu 3 – Sat 5 Dec 2026",
    );
  });

  it("names both months when the event crosses a month", () => {
    expect(
      formatEventDates("2026-11-30T04:00:00Z", "2026-12-02T12:00:00Z", IST),
    ).toBe("30 Nov – 2 Dec 2026");
  });

  it("names both years when the event crosses a year", () => {
    expect(
      formatEventDates("2026-12-31T04:00:00Z", "2027-01-01T12:00:00Z", IST),
    ).toBe("31 Dec 2026 – 1 Jan 2027");
  });

  it("uses the event's own zone: 20:00 UTC is already the next day in India", () => {
    expect(
      formatEventDates("2026-12-03T20:00:00Z", "2026-12-03T21:00:00Z", IST),
    ).toBe("4 Dec 2026");
  });
});

describe("formatEventTimes", () => {
  it("shows start and end in the event's zone with its name", () => {
    const e = byId(SUMMIT_ID);
    expect(formatEventTimes(e.startAt, e.endAt, IST)).toBe("09:00 – 18:00 IST");
  });

  it("shows the IANA name for a zone it has no short name for", () => {
    expect(zoneLabel("Europe/Berlin")).toBe("Europe/Berlin");
    expect(zoneLabel(IST)).toBe("IST");
  });
});

describe("thumbDate and toFormDateTime", () => {
  it("gives a two-digit day and an upper-case month", () => {
    expect(thumbDate(byId(SUMMIT_ID).startAt, IST)).toEqual({
      day: "03",
      month: "DEC",
    });
  });

  it("gives the date and time as the form's inputs want them", () => {
    expect(toFormDateTime(byId(FINTECH_ID).startAt, IST)).toEqual({
      date: "2026-12-12",
      time: "09:30",
    });
  });
});

describe("formatTicketPrice", () => {
  it("shows Free for 0, whole rupees without decimals, and paise with two", () => {
    expect(formatTicketPrice(0)).toBe("Free");
    expect(formatTicketPrice(49900)).toBe("₹499");
    expect(formatTicketPrice(49950)).toBe("₹499.50");
    expect(formatTicketPrice(150000)).toBe("₹1,500");
  });
});

describe("fillPercent", () => {
  it("rounds, caps at 100 and is 0 without a limit", () => {
    expect(fillPercent(480, 600)).toBe(80);
    expect(fillPercent(700, 600)).toBe(100);
    expect(fillPercent(5, null)).toBe(0);
    expect(fillPercent(0, 0)).toBe(0);
  });
});

describe("registrationsCell", () => {
  it("is a bar for a published event with a limit", () => {
    expect(registrationsCell(byId(SUMMIT_ID))).toEqual({
      kind: "bar",
      registered: 480,
      capacity: 600,
    });
  });

  it("says a draft opens when published", () => {
    expect(registrationsCell(byId(FINTECH_ID))).toEqual({
      kind: "text",
      text: "Opens when published",
    });
  });

  it("counts the cancelled registrations of a cancelled event", () => {
    expect(registrationsCell(byId(MEETUP_ID))).toEqual({
      kind: "text",
      text: "86 registrations cancelled",
    });
    expect(
      registrationsCell({ ...byId(MEETUP_ID), cancelledRegistrations: 0 }),
    ).toEqual({ kind: "text", text: "No registrations" });
  });

  it("is plain text for an event with no limit", () => {
    expect(registrationsCell({ ...byId(SUMMIT_ID), capacity: null })).toEqual({
      kind: "text",
      text: "480 registered",
    });
  });
});

describe("sessionsCell", () => {
  it("counts scheduled sessions", () => {
    expect(sessionsCell(byId(SUMMIT_ID))).toEqual({
      primary: "24 sessions",
      secondary: "22 scheduled",
      warn: false,
    });
  });

  it("warns for a draft whose sessions are all unscheduled", () => {
    expect(sessionsCell(byId(FINTECH_ID))).toEqual({
      primary: "2 sessions",
      secondary: "0 scheduled",
      warn: true,
    });
  });

  it("says when every session was cancelled", () => {
    expect(sessionsCell(byId(MEETUP_ID)).secondary).toBe("All cancelled");
  });
});

describe("small helpers", () => {
  it("plural picks one or many", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(2, "session")).toBe("2 sessions");
    expect(plural(0, "hall")).toBe("0 halls");
    expect(plural(2, "registered attendee")).toBe("2 registered attendees");
  });

  it("venueLine names the venue, or says none is chosen", () => {
    expect(venueLine(byId(SUMMIT_ID))).toBe("Convention Centre, Pune");
    expect(venueLine({ venue: null })).toBe("No venue chosen yet");
  });

  it("only a draft or published event can be edited", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("published")).toBe(true);
    expect(isEditable("completed")).toBe(false);
    expect(isEditable("cancelled")).toBe(false);
    expect(byId(FUTURES_ID).status).toBe("completed");
  });
});
