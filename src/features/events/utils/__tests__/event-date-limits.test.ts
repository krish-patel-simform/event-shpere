import {
  earliestEndTime,
  earliestStartTime,
  eventDateLimits,
} from "../event-date-limits";

// 10:20 IST on 6 Nov 2026 is 04:50 UTC.
const NOW = new Date("2026-11-06T04:50:00.000Z");

describe("eventDateLimits", () => {
  it("runs from today to ten years ahead", () => {
    expect(eventDateLimits(NOW)).toEqual({
      min: "2026-11-06",
      max: "2036-11-06",
    });
  });

  it("counts today in India, not in UTC", () => {
    // 19:00 UTC on 6 Nov is already 00:30 IST on 7 Nov.
    const lateNight = new Date("2026-11-06T19:00:00.000Z");

    expect(eventDateLimits(lateNight).min).toBe("2026-11-07");
  });

  it("keeps 29 February to a real day ten years on", () => {
    // 12:00 IST on 29 Feb 2028.
    const leapDay = new Date("2028-02-29T06:30:00.000Z");

    expect(eventDateLimits(leapDay).max).toBe("2038-02-28");
  });
});

describe("earliestStartTime", () => {
  it("is the next 15-minute slot after now when the event starts today", () => {
    expect(earliestStartTime("2026-11-06", NOW)).toBe("10:30");
  });

  it("moves on to the next slot when now is exactly on one", () => {
    const onTheSlot = new Date("2026-11-06T04:45:00.000Z"); // 10:15 IST

    expect(earliestStartTime("2026-11-06", onTheSlot)).toBe("10:30");
  });

  it("allows any time on a later day", () => {
    expect(earliestStartTime("2026-11-07", NOW)).toBe("00:00");
  });

  it("allows any time while no date is chosen", () => {
    expect(earliestStartTime("", NOW)).toBe("00:00");
  });

  it("is null when no slot is left today", () => {
    const lateNight = new Date("2026-11-06T18:20:00.000Z"); // 23:50 IST

    expect(earliestStartTime("2026-11-06", lateNight)).toBeNull();
  });
});

describe("earliestEndTime", () => {
  it("is one minute after the start when the event ends the day it starts", () => {
    expect(earliestEndTime("2026-12-12", "09:00", "2026-12-12")).toBe("09:01");
  });

  it("allows any time when the event ends on a later day", () => {
    expect(earliestEndTime("2026-12-12", "09:00", "2026-12-13")).toBe("00:00");
  });

  it("allows any time while the start or the end is not filled in", () => {
    expect(earliestEndTime("", "09:00", "")).toBe("00:00");
    expect(earliestEndTime("2026-12-12", "", "2026-12-12")).toBe("00:00");
  });

  it("is null when the start is the last minute of the day", () => {
    expect(earliestEndTime("2026-12-12", "23:59", "2026-12-12")).toBeNull();
  });
});
