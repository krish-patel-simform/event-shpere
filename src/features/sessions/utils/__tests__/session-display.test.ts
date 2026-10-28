import {
  allSessions,
  endedPanel,
  NOW,
  pwaTalk,
  reduxTalk,
  scalingTalk,
  sentryDraft,
  zodWorkshop,
} from "../../__fixtures__/sessions";
import {
  applySessionFilters,
  countByTab,
  DEFAULT_SESSION_FILTERS,
  daysUntil,
  eventNames,
  fillPercent,
  formatDayFull,
  formatDayShort,
  formatFileSize,
  formatTimeRange,
  inTab,
  isFiltering,
  isPast,
  sessionStatusBadge,
  sessionSubline,
  trendBarHeights,
} from "../session-display";

const titles = (list: readonly { title: string }[]) =>
  list.map((session) => session.title);

describe("isPast", () => {
  it("is true for a completed session", () => {
    expect(isPast(reduxTalk, NOW)).toBe(true);
  });

  it("is true for a confirmed session that ended before now", () => {
    expect(isPast(endedPanel, NOW)).toBe(true);
  });

  it("is false for an upcoming session and for one with no date", () => {
    expect(isPast(scalingTalk, NOW)).toBe(false);
    expect(isPast(pwaTalk, NOW)).toBe(false);
    expect(isPast(sentryDraft, NOW)).toBe(false);
  });
});

describe("tabs", () => {
  it("counts every tab, and a finished session is only in All and Past", () => {
    expect(countByTab(allSessions, NOW)).toEqual({
      all: 6,
      confirmed: 2,
      under_review: 1,
      draft: 1,
      past: 2,
    });
    expect(inTab(endedPanel, "confirmed", NOW)).toBe(false);
    expect(inTab(endedPanel, "past", NOW)).toBe(true);
  });
});

describe("applySessionFilters", () => {
  it("sorts by date: upcoming first, then not scheduled, then past (latest first)", () => {
    const result = applySessionFilters(
      allSessions,
      DEFAULT_SESSION_FILTERS,
      NOW,
    );
    expect(titles(result)).toEqual([
      scalingTalk.title,
      zodWorkshop.title,
      sentryDraft.title, // edited last
      pwaTalk.title,
      endedPanel.title,
      reduxTalk.title,
    ]);
  });

  it("sorts by registrations (or attendance), most first", () => {
    const result = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, sort: "registrations" },
      NOW,
    );
    expect(titles(result).slice(0, 3)).toEqual([
      reduxTalk.title, // 412 attended
      endedPanel.title, // 200
      scalingTalk.title, // 95
    ]);
  });

  it("filters by tab", () => {
    const result = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, tab: "past" },
      NOW,
    );
    expect(titles(result)).toEqual([endedPanel.title, reduxTalk.title]);
  });

  it("searches the title and the track, ignoring case", () => {
    const byTitle = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, search: "  ZOD " },
      NOW,
    );
    expect(titles(byTitle)).toEqual([zodWorkshop.title]);

    const byTrack = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, search: "mobile" },
      NOW,
    );
    expect(titles(byTrack)).toEqual([pwaTalk.title]);
  });

  it("filters by event and by format", () => {
    const byEvent = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, event: "Meetup" },
      NOW,
    );
    expect(titles(byEvent)).toEqual([zodWorkshop.title, sentryDraft.title]);

    const byFormat = applySessionFilters(
      allSessions,
      { ...DEFAULT_SESSION_FILTERS, format: "panel" },
      NOW,
    );
    expect(titles(byFormat)).toEqual([endedPanel.title]);
  });

  it("does not change the list it is given", () => {
    const copy = [...allSessions];
    applySessionFilters(allSessions, DEFAULT_SESSION_FILTERS, NOW);
    expect(allSessions).toEqual(copy);
  });
});

describe("isFiltering and eventNames", () => {
  it("is false for the defaults and true when anything narrows the list", () => {
    expect(isFiltering(DEFAULT_SESSION_FILTERS)).toBe(false);
    expect(
      isFiltering({ ...DEFAULT_SESSION_FILTERS, sort: "registrations" }),
    ).toBe(false);
    expect(isFiltering({ ...DEFAULT_SESSION_FILTERS, search: "x" })).toBe(true);
    expect(isFiltering({ ...DEFAULT_SESSION_FILTERS, tab: "draft" })).toBe(
      true,
    );
    expect(isFiltering({ ...DEFAULT_SESSION_FILTERS, event: "Meetup" })).toBe(
      true,
    );
  });

  it("lists each event once, sorted", () => {
    expect(eventNames(allSessions)).toEqual([
      "Frontend Day 2025",
      "Meetup",
      "Summit 2026",
    ]);
  });
});

describe("labels", () => {
  it("gives every status a label (never colour only)", () => {
    expect(sessionStatusBadge("confirmed").label).toBe("Confirmed");
    expect(sessionStatusBadge("under_review").label).toBe("Under review");
    expect(sessionStatusBadge("draft").label).toBe("Draft");
    expect(sessionStatusBadge("completed").label).toBe("Completed");
  });

  it("builds the grey line under a title", () => {
    expect(sessionSubline(scalingTalk)).toBe(
      "Talk · 45 min · Frontend Architecture",
    );
    expect(sessionSubline(sentryDraft)).toBe(
      "Talk · 30 min · Last edited 25 May 2026",
    );
    expect(sessionSubline(reduxTalk)).toBe("Talk · 30 min · Rated 4.7 / 5");
  });
});

describe("dates and numbers", () => {
  it("formats the day and the time range in UTC", () => {
    expect(formatDayShort("2026-12-04T04:30:00.000Z")).toBe("Fri, 4 Dec");
    expect(formatDayFull("2025-06-14T09:30:00.000Z")).toBe("Sat, 14 Jun 2025");
    expect(
      formatTimeRange("2026-12-04T04:30:00.000Z", "2026-12-04T05:15:00.000Z"),
    ).toBe("04:30 – 05:15");
  });

  it("counts whole days until a date and never goes below 0", () => {
    expect(
      daysUntil("2026-11-15T23:59:00.000Z", "2026-10-27T09:00:00.000Z"),
    ).toBe(20);
    expect(
      daysUntil("2026-10-01T00:00:00.000Z", "2026-10-27T09:00:00.000Z"),
    ).toBe(0);
  });

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1_887_436)).toBe("1.8 MB");
  });

  it("computes the seat percentage, capped and safe for 0 seats", () => {
    expect(fillPercent(248, 300)).toBe(83);
    expect(fillPercent(310, 300)).toBe(100);
    expect(fillPercent(5, 0)).toBe(0);
  });

  it("scales the bars to the busiest day", () => {
    expect(
      trendBarHeights([
        { date: "a", count: 10 },
        { date: "b", count: 5 },
      ]),
    ).toEqual([100, 50]);
    expect(trendBarHeights([{ date: "a", count: 0 }])).toEqual([0]);
    expect(trendBarHeights([])).toEqual([]);
  });
});
