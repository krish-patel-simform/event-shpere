import {
  SAMPLE_ATTENDEES,
  SAMPLE_SESSIONS,
} from "../../sample/organizer-sample";
import {
  averageBookings,
  DEFAULT_ATTENDEE_FILTERS,
  filterAttendees,
  isFilteringAttendees,
  parseStatusFilter,
} from "../event-attendees";

const names = (rows: readonly { name: string }[]) =>
  rows.map((row) => row.name);
const keynote = SAMPLE_SESSIONS[0];

describe("filterAttendees", () => {
  it("gives every attendee when nothing is set", () => {
    expect(
      filterAttendees(SAMPLE_ATTENDEES, DEFAULT_ATTENDEE_FILTERS),
    ).toHaveLength(SAMPLE_ATTENDEES.length);
  });

  it("searches the name and the email, in any case", () => {
    expect(
      names(
        filterAttendees(SAMPLE_ATTENDEES, {
          ...DEFAULT_ATTENDEE_FILTERS,
          search: " NEHA ",
        }),
      ),
    ).toEqual(["Neha Kapoor"]);
    expect(
      names(
        filterAttendees(SAMPLE_ATTENDEES, {
          ...DEFAULT_ATTENDEE_FILTERS,
          search: "sandeep.k@",
        }),
      ),
    ).toEqual(["Sandeep Kulkarni"]);
  });

  it("keeps only the people who booked the chosen session", () => {
    const result = filterAttendees(SAMPLE_ATTENDEES, {
      ...DEFAULT_ATTENDEE_FILTERS,
      sessionId: keynote.id,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.sessionIds.includes(keynote.id))).toBe(true);
  });

  it("keeps only the attendees with the chosen status", () => {
    expect(
      names(
        filterAttendees(SAMPLE_ATTENDEES, {
          ...DEFAULT_ATTENDEE_FILTERS,
          status: "cancelled",
        }),
      ),
    ).toEqual(["Sandeep Kulkarni", "Lata Deshmukh"]);
  });

  it("applies every filter together", () => {
    expect(
      names(
        filterAttendees(SAMPLE_ATTENDEES, {
          search: "lata",
          sessionId: keynote.id,
          status: "registered",
        }),
      ),
    ).toEqual([]);
  });
});

describe("isFilteringAttendees", () => {
  it("is false for the defaults and for a blank search", () => {
    expect(isFilteringAttendees(DEFAULT_ATTENDEE_FILTERS)).toBe(false);
    expect(
      isFilteringAttendees({ ...DEFAULT_ATTENDEE_FILTERS, search: "  " }),
    ).toBe(false);
  });

  it("is true when anything is set", () => {
    expect(
      isFilteringAttendees({
        ...DEFAULT_ATTENDEE_FILTERS,
        status: "cancelled",
      }),
    ).toBe(true);
    expect(
      isFilteringAttendees({
        ...DEFAULT_ATTENDEE_FILTERS,
        sessionId: keynote.id,
      }),
    ).toBe(true);
  });
});

describe("parseStatusFilter and averageBookings", () => {
  it("reads a status, and treats anything else as all", () => {
    expect(parseStatusFilter("registered")).toBe("registered");
    expect(parseStatusFilter("cancelled")).toBe("cancelled");
    expect(parseStatusFilter("nonsense")).toBe("all");
  });

  it("averages bookings per attendee to one decimal", () => {
    expect(averageBookings(1286, 480)).toBe("2.7");
    expect(averageBookings(0, 0)).toBe("0");
  });
});
