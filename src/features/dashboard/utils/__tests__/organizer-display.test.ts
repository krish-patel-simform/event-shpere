import {
  daysWaiting,
  formatEventCounts,
  OVERDUE_AFTER_DAYS,
  waitingLabel,
} from "../organizer-display";

describe("daysWaiting", () => {
  it("counts whole days between the application and the reference time", () => {
    expect(daysWaiting("2026-10-12T09:00:00Z", "2026-10-26T12:00:00Z")).toBe(
      14,
    );
  });

  it("does not round a partial day up", () => {
    expect(daysWaiting("2026-10-25T13:00:00Z", "2026-10-26T12:00:00Z")).toBe(0);
  });

  it("is never negative, even if the application is dated after the reference", () => {
    expect(daysWaiting("2026-10-27T09:00:00Z", "2026-10-26T12:00:00Z")).toBe(0);
  });
});

describe("waitingLabel", () => {
  it.each([
    [0, "Applied today"],
    [1, "1 day waiting"],
    [6, "6 days waiting"],
  ])("%i days → %s", (days, label) => {
    expect(waitingLabel(days)).toBe(label);
  });
});

describe("OVERDUE_AFTER_DAYS", () => {
  it("is the point from which the design shows the wait in red (9 days, not 8)", () => {
    expect(8 > OVERDUE_AFTER_DAYS).toBe(false);
    expect(9 > OVERDUE_AFTER_DAYS).toBe(true);
  });
});

describe("formatEventCounts", () => {
  it.each([
    [{ published: 6, drafts: 2, completed: 0 }, "6 published · 2 drafts"],
    [{ published: 3, drafts: 0, completed: 0 }, "3 published"],
    [{ published: 4, drafts: 1, completed: 0 }, "4 published · 1 draft"],
    [{ published: 0, drafts: 0, completed: 2 }, "2 completed"],
    [
      { published: 1, drafts: 1, completed: 5 },
      "1 published · 1 draft · 5 completed",
    ],
  ])("%j → %s", (events, text) => {
    expect(formatEventCounts(events)).toBe(text);
  });

  it("says so when an organizer has no events", () => {
    expect(formatEventCounts({ published: 0, drafts: 0, completed: 0 })).toBe(
      "No events yet",
    );
  });
});
