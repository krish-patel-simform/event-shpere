import {
  dailyRunMs,
  dayCheckInWindow,
  eventDayKeys,
  eventDayOf,
} from "../attendance-day";

const HOUR_MS = 60 * 60 * 1000;
const ZONE = "Asia/Kolkata";

// 12–14 Dec 2026, every day 09:30 → 17:30 IST (04:00 → 12:00 UTC).
const event = {
  startAt: new Date("2026-12-12T04:00:00.000Z"),
  endAt: new Date("2026-12-14T12:00:00.000Z"),
  timezone: ZONE,
};

// One night only: 12 Dec 22:00 → 13 Dec 02:00 IST.
const overnight = {
  startAt: new Date("2026-12-12T16:30:00.000Z"),
  endAt: new Date("2026-12-12T20:30:00.000Z"),
  timezone: ZONE,
};

// Three nights: every night 22:00 → 02:00 IST, 12 Dec to the morning of 15 Dec.
const threeNights = {
  startAt: new Date("2026-12-12T16:30:00.000Z"),
  endAt: new Date("2026-12-14T20:30:00.000Z"),
  timezone: ZONE,
};

describe("dailyRunMs", () => {
  it("is the same hours every day: 09:30 → 17:30 is 8 hours", () => {
    expect(dailyRunMs(event)).toBe(8 * HOUR_MS);
  });

  it("runs past midnight when the end's clock time is before the start's: 22:00 → 02:00 is 4 hours", () => {
    expect(dailyRunMs(overnight)).toBe(4 * HOUR_MS);
    expect(dailyRunMs(threeNights)).toBe(4 * HOUR_MS);
  });

  it("is a full day, not zero, for exactly 24 hours", () => {
    expect(
      dailyRunMs({
        startAt: "2026-12-12T03:30:00.000Z",
        endAt: "2026-12-13T03:30:00.000Z",
        timezone: ZONE,
      }),
    ).toBe(24 * HOUR_MS);
  });
});

describe("eventDayKeys", () => {
  it("lists every day of the event in its own zone", () => {
    expect(eventDayKeys(event)).toEqual([
      "2026-12-12",
      "2026-12-13",
      "2026-12-14",
    ]);
  });

  it("takes ISO strings as well as dates", () => {
    expect(
      eventDayKeys({
        startAt: "2026-12-12T04:00:00.000Z",
        endAt: "2026-12-12T12:00:00.000Z",
        timezone: ZONE,
      }),
    ).toEqual(["2026-12-12"]);
  });

  it("counts an overnight event as ONE day (no fake day 2), keyed by the date it starts", () => {
    expect(eventDayKeys(overnight)).toEqual(["2026-12-12"]);
  });

  it("counts one day per night for a multi-night event", () => {
    expect(eventDayKeys(threeNights)).toEqual([
      "2026-12-12",
      "2026-12-13",
      "2026-12-14",
    ]);
  });

  it("counts a 24-hour event as one day", () => {
    expect(
      eventDayKeys({
        startAt: "2026-12-12T03:30:00.000Z",
        endAt: "2026-12-13T03:30:00.000Z",
        timezone: ZONE,
      }),
    ).toEqual(["2026-12-12"]);
  });
});

describe("dayCheckInWindow", () => {
  it("is null for a date that is not a day of the event", () => {
    expect(dayCheckInWindow("2026-12-11", event, 6)).toBeNull();
    expect(dayCheckInWindow("2026-12-15", event, 6)).toBeNull();
    expect(dayCheckInWindow("2026-12-13", overnight, 6)).toBeNull();
  });

  it("day 1: opens 6 hours before its start, closes when ITS hours end", () => {
    expect(dayCheckInWindow("2026-12-12", event, 6)).toEqual({
      // 12 Dec 03:30 IST.
      opensAt: new Date("2026-12-11T22:00:00.000Z"),
      // 12 Dec 17:30 IST.
      closesAt: new Date("2026-12-12T12:00:00.000Z"),
    });
  });

  it("a middle day runs on the same hours as day 1", () => {
    expect(dayCheckInWindow("2026-12-13", event, 6)).toEqual({
      opensAt: new Date("2026-12-12T22:00:00.000Z"),
      closesAt: new Date("2026-12-13T12:00:00.000Z"),
    });
  });

  it("the last day closes when the event ends", () => {
    expect(dayCheckInWindow("2026-12-14", event, 6)?.closesAt).toEqual(
      event.endAt,
    );
  });

  it("opens earlier with a bigger setting (dev: a year), but closes at the same moment", () => {
    const window = dayCheckInWindow("2026-12-13", event, 24 * 365);
    expect(window?.opensAt).toEqual(new Date("2025-12-13T04:00:00.000Z"));
    expect(window?.closesAt).toEqual(new Date("2026-12-13T12:00:00.000Z"));
  });

  it("works for days that start very early: 01:00 starts open at 19:00 the evening before", () => {
    const early = {
      // 12 Dec 01:00 IST; every day 01:00 → 18:00.
      startAt: new Date("2026-12-11T19:30:00.000Z"),
      endAt: new Date("2026-12-13T12:30:00.000Z"),
      timezone: ZONE,
    };
    expect(dayCheckInWindow("2026-12-12", early, 6)).toEqual({
      // 11 Dec 19:00 IST.
      opensAt: new Date("2026-12-11T13:30:00.000Z"),
      // 12 Dec 18:00 IST.
      closesAt: new Date("2026-12-12T12:30:00.000Z"),
    });
    expect(dayCheckInWindow("2026-12-13", early, 6)).toEqual({
      // 12 Dec 19:00 IST.
      opensAt: new Date("2026-12-12T13:30:00.000Z"),
      closesAt: early.endAt,
    });
  });

  it("keeps a running day open for late arrivals even when the next day's door has opened", () => {
    // Every day 08:00 → 04:00 the next morning: only 4 hours between two days.
    const long = {
      startAt: new Date("2026-12-12T02:30:00.000Z"),
      endAt: new Date("2026-12-13T22:30:00.000Z"),
      timezone: ZONE,
    };
    const day1 = dayCheckInWindow("2026-12-12", long, 6)!;
    const day2 = dayCheckInWindow("2026-12-13", long, 6)!;
    // 13 Dec 03:00 IST: day 1 still runs (until 04:00), day 2 opened at 02:00.
    const lateArrival = new Date("2026-12-12T21:30:00.000Z");

    expect(day1.closesAt).toEqual(new Date("2026-12-12T22:30:00.000Z"));
    expect(lateArrival < day1.closesAt).toBe(true);
    expect(day2.opensAt <= lateArrival).toBe(true);
  });

  it("an overnight event's one day is open until the event ends, past midnight", () => {
    expect(dayCheckInWindow("2026-12-12", overnight, 6)).toEqual({
      // 12 Dec 16:00 IST.
      opensAt: new Date("2026-12-12T10:30:00.000Z"),
      closesAt: overnight.endAt,
    });
  });
});

describe("eventDayOf (the day a session belongs to)", () => {
  it.each([
    // [moment in UTC, what it is in IST, event day]
    ["2026-12-12T05:30:00.000Z", "12 Dec 11:00", "2026-12-12"],
    [
      "2026-12-12T11:59:00.000Z",
      "12 Dec 17:29, the end of day 1",
      "2026-12-12",
    ],
    ["2026-12-12T12:00:00.000Z", "12 Dec 17:30, day 1 has ended", "2026-12-13"],
    ["2026-12-12T18:30:00.000Z", "13 Dec 00:00, between days", "2026-12-13"],
    ["2026-12-14T08:00:00.000Z", "14 Dec 13:30", "2026-12-14"],
  ])("%s (%s) is %s", (moment, _ist, day) => {
    expect(eventDayOf(new Date(moment), event)).toBe(day);
  });

  it("is day 1 before the event and the last day after it", () => {
    expect(eventDayOf(new Date("2026-11-01T00:00:00.000Z"), event)).toBe(
      "2026-12-12",
    );
    expect(eventDayOf(new Date("2026-12-20T00:00:00.000Z"), event)).toBe(
      "2026-12-14",
    );
  });

  it("puts a 01:00 session of a night event on the night it started", () => {
    // 14 Dec 01:00 IST is the second night (13 Dec 22:00 → 14 Dec 02:00).
    expect(eventDayOf(new Date("2026-12-13T19:30:00.000Z"), threeNights)).toBe(
      "2026-12-13",
    );
  });
});
