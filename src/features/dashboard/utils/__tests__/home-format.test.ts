import {
  formatDateRange,
  formatDue,
  formatFullDate,
  formatPrice,
  formatRelativeTime,
  formatTime,
  formatWeekdayRange,
  getCountdown,
  isDue,
  percentOf,
} from "../home-format";

const NOW = "2026-10-20T09:00:00Z";

describe("date text (India time, whatever the machine's zone)", () => {
  it("formats the time in IST", () => {
    expect(formatTime("2026-12-04T04:30:00Z")).toBe("10:00");
    // 19:00 UTC is already the next morning in India.
    expect(
      formatDateRange("2026-12-03T19:00:00Z", "2026-12-03T19:00:00Z"),
    ).toBe("4 Dec");
  });

  it("writes ranges in one, two or more days and months", () => {
    expect(
      formatDateRange("2026-11-14T04:00:00Z", "2026-11-14T12:00:00Z"),
    ).toBe("14 Nov");
    expect(
      formatDateRange("2026-12-03T03:30:00Z", "2026-12-05T12:30:00Z"),
    ).toBe("3–5 Dec");
    expect(
      formatDateRange("2026-11-28T03:30:00Z", "2026-12-02T12:30:00Z"),
    ).toBe("28 Nov – 2 Dec");
    expect(
      formatWeekdayRange("2026-12-03T03:30:00Z", "2026-12-05T12:30:00Z"),
    ).toBe("Thu 3 – Sat 5 Dec");
  });

  it("writes the full date", () => {
    expect(formatFullDate(NOW)).toBe("Tuesday, 20 October 2026");
  });

  it("writes the price", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(1500)).toBe("₹1,500");
  });
});

describe("formatRelativeTime", () => {
  it.each([
    ["2026-10-20T08:59:40Z", "just now"],
    ["2026-10-20T08:59:00Z", "1 minute ago"],
    ["2026-10-20T08:00:00Z", "1 hour ago"],
    ["2026-10-20T04:00:00Z", "5 hours ago"],
    ["2026-10-18T07:00:00Z", "2 days ago"],
    ["2026-10-01T07:00:00Z", "1 Oct"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });
});

describe("getCountdown", () => {
  it("whole days, hours and minutes left", () => {
    expect(getCountdown("2026-12-03T03:30:00Z", NOW)).toEqual({
      days: 43,
      hours: 18,
      minutes: 30,
      started: false,
    });
  });

  it("started once the time has passed", () => {
    expect(getCountdown(NOW, NOW).started).toBe(true);
    expect(getCountdown("2026-10-19T09:00:00Z", NOW)).toMatchObject({
      days: 0,
      started: true,
    });
  });
});

describe("due dates", () => {
  it("counts calendar days", () => {
    expect(formatDue("2026-11-15T12:00:00Z", NOW)).toBe(
      "Due 15 Nov · 26 days left",
    );
    expect(formatDue("2026-10-21T12:00:00Z", NOW)).toBe(
      "Due 21 Oct · 1 day left",
    );
    expect(formatDue("2026-10-20T12:00:00Z", NOW)).toBe("Due today");
    expect(formatDue("2026-10-18T12:00:00Z", NOW)).toBe("Due 18 Oct · overdue");
  });

  it("is due today or earlier", () => {
    expect(isDue("2026-10-20T12:00:00Z", NOW)).toBe(true);
    expect(isDue("2026-10-21T12:00:00Z", NOW)).toBe(false);
  });
});

describe("percentOf", () => {
  it("stays between 0 and 100 and never divides by zero", () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(5, 4)).toBe(100);
    expect(percentOf(-1, 4)).toBe(0);
    expect(percentOf(3, 0)).toBe(0);
  });
});
