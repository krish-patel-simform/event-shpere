import { formatClock, formatOpenFor, timeAgo } from "../poll-time";

const NOW = "2026-12-04T10:20:00.000Z";

describe("formatClock", () => {
  it("prints the UTC time as 24 hour HH:MM", () => {
    expect(formatClock("2026-12-04T10:02:00.000Z")).toBe("10:02");
    expect(formatClock("2026-12-04T09:05:00.000Z")).toBe("09:05");
  });
});

describe("timeAgo", () => {
  it.each([
    ["2026-12-04T10:19:40.000Z", "just now"],
    ["2026-12-04T10:16:00.000Z", "4 min ago"],
    ["2026-12-04T08:00:00.000Z", "2 h ago"],
    ["2026-12-01T10:20:00.000Z", "3 d ago"],
    ["2026-12-04T10:30:00.000Z", "just now"],
  ])("%s is %s", (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });
});

describe("formatOpenFor", () => {
  it("says minutes under an hour", () => {
    expect(formatOpenFor("2026-12-04T10:06:00.000Z", NOW)).toBe("14 min");
  });

  it("says hours and minutes after that", () => {
    expect(formatOpenFor("2026-12-04T09:15:00.000Z", NOW)).toBe("1 h 05 min");
  });
});
