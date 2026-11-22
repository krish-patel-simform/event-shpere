import { formatZonedDateTime, zonedDayKey } from "../format-zoned";

describe("zonedDayKey", () => {
  it("is the calendar day in the zone, not in UTC", () => {
    // 18:31 UTC on the 2nd is 00:01 on the 3rd in India.
    expect(zonedDayKey("2026-12-02T18:31:00.000Z", "Asia/Kolkata")).toBe(
      "2026-12-03",
    );
    expect(zonedDayKey("2026-12-02T18:31:00.000Z", "UTC")).toBe("2026-12-02");
  });

  it("takes a Date as well as an ISO string", () => {
    expect(
      zonedDayKey(new Date("2026-12-02T18:31:00.000Z"), "Asia/Kolkata"),
    ).toBe("2026-12-03");
  });
});

describe("formatZonedDateTime", () => {
  it("shows the moment as the clock reads it in the given zone", () => {
    // 12:30 UTC = 18:00 in India.
    expect(
      formatZonedDateTime("2026-12-02T12:30:00.000Z", "Asia/Kolkata"),
    ).toBe("Wed 2 Dec 2026, 18:00");
  });

  it("moves to the zone's own day across midnight", () => {
    // 20:00 UTC on the 2nd is 01:30 on the 3rd in India.
    expect(
      formatZonedDateTime("2026-12-02T20:00:00.000Z", "Asia/Kolkata"),
    ).toBe("Thu 3 Dec 2026, 01:30");
  });

  it("uses a 24-hour clock, midnight as 00", () => {
    expect(formatZonedDateTime("2026-12-02T00:05:00.000Z", "UTC")).toBe(
      "Wed 2 Dec 2026, 00:05",
    );
  });
});
