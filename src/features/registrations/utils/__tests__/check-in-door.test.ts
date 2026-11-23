import { doorDays, eventDoor, sessionDoor } from "../check-in-door";

// 3 Dec 09:00 IST – 5 Dec 18:00 IST: three event days. Each day starts at 09:00 IST (03:30 UTC).
// Day 1 closes 6 h before day 2 starts (4 Dec 03:00 IST), day 2 on 5 Dec 03:00 IST, day 3 at the end.
const event = {
  startAt: "2026-12-03T03:30:00.000Z",
  endAt: "2026-12-05T12:30:00.000Z",
  timezone: "Asia/Kolkata",
};
const PROD = 6;
const DEV = 24 * 365;
const at = (iso: string) => new Date(iso);

describe("doorDays (the same windows as the server's dayCheckInWindow)", () => {
  it("lists every day with its label and 'Day n of 3'", () => {
    const days = doorDays(event, PROD, at("2026-12-01T00:00:00.000Z"));

    expect(days.map((day) => [day.key, day.label, day.dayOfLabel])).toEqual([
      ["2026-12-03", "Thu 3 Dec", "Day 1 of 3"],
      ["2026-12-04", "Fri 4 Dec", "Day 2 of 3"],
      ["2026-12-05", "Sat 5 Dec", "Day 3 of 3"],
    ]);
  });

  it("in production only the running day is open: day 2 at 08:00 on 4 Dec", () => {
    // 4 Dec 08:00 IST.
    const days = doorDays(event, PROD, at("2026-12-04T02:30:00.000Z"));

    expect(days.map((day) => day.state)).toEqual([
      "closed",
      "open",
      "not-open",
    ]);
  });

  it("opens a day exactly 6 hours before it starts, and closes it exactly at the split", () => {
    // Day 1 opens 3 Dec 03:00 IST = 2 Dec 21:30 UTC.
    expect(doorDays(event, PROD, at("2026-12-02T21:29:59.999Z"))[0].state).toBe(
      "not-open",
    );
    expect(doorDays(event, PROD, at("2026-12-02T21:30:00.000Z"))[0].state).toBe(
      "open",
    );
    // Day 1 closes 4 Dec 03:00 IST = 3 Dec 21:30 UTC, the moment day 2 opens.
    const atSplit = doorDays(event, PROD, at("2026-12-03T21:30:00.000Z"));
    expect(atSplit.map((day) => day.state)).toEqual([
      "closed",
      "open",
      "not-open",
    ]);
  });

  it("closes the last day when the event ends", () => {
    const days = doorDays(event, PROD, at("2026-12-05T12:30:00.000Z"));

    expect(days.every((day) => day.state === "closed")).toBe(true);
  });

  it("in dev (a year early) every day that has not closed is open", () => {
    const days = doorDays(event, DEV, at("2026-11-20T10:00:00.000Z"));

    expect(days.map((day) => day.state)).toEqual(["open", "open", "open"]);
  });

  it("says nothing like 'Day 1 of 1' on a one-day event", () => {
    const days = doorDays(
      { ...event, endAt: "2026-12-03T12:30:00.000Z" },
      PROD,
      at("2026-12-03T04:00:00.000Z"),
    );

    expect(days).toHaveLength(1);
    expect(days[0].dayOfLabel).toBeNull();
  });
});

describe("eventDoor", () => {
  const prodDays = (now: string) => doorDays(event, PROD, at(now));

  it("never opens for a draft or a cancelled event, and is closed for a completed one", () => {
    const days = prodDays("2026-12-04T02:30:00.000Z");

    expect(eventDoor("draft", days, null)).toEqual({ kind: "draft" });
    expect(eventDoor("cancelled", days, null)).toEqual({ kind: "cancelled" });
    expect(eventDoor("completed", days, null)).toEqual({ kind: "closed" });
  });

  it("picks the running day for the staff", () => {
    const door = eventDoor(
      "published",
      prodDays("2026-12-04T02:30:00.000Z"),
      null,
    );

    expect(door.kind === "open" && door.day.key).toBe("2026-12-04");
  });

  it("keeps the day the staff picked while it is open", () => {
    const days = doorDays(event, DEV, at("2026-11-20T10:00:00.000Z"));

    const door = eventDoor("published", days, "2026-12-05");

    expect(door.kind === "open" && door.day.key).toBe("2026-12-05");
  });

  it("moves to the open day when the picked one closes (or was never open)", () => {
    const days = prodDays("2026-12-04T02:30:00.000Z");

    for (const picked of ["2026-12-03", "2026-12-05", "2027-01-01"]) {
      const door = eventDoor("published", days, picked);
      expect(door.kind === "open" && door.day.key).toBe("2026-12-04");
    }
  });

  it("says when the next day opens before the first one has", () => {
    expect(
      eventDoor("published", prodDays("2026-12-01T00:00:00.000Z"), null),
    ).toEqual({
      kind: "not-open",
      opensAt: at("2026-12-02T21:30:00.000Z"),
    });
  });

  it("is closed once every day has closed", () => {
    expect(
      eventDoor("published", prodDays("2026-12-06T00:00:00.000Z"), null),
    ).toEqual({ kind: "closed" });
  });
});

describe("sessionDoor (route 11's order)", () => {
  // 3 Dec 10:00–10:45 IST.
  const session = {
    eventStatus: "published" as const,
    status: "scheduled" as const,
    startAt: "2026-12-03T04:30:00.000Z",
    endAt: "2026-12-03T05:15:00.000Z",
  };
  const door = (overrides = {}, now = "2026-12-03T04:00:00.000Z", hours = 2) =>
    sessionDoor({ ...session, ...overrides }, hours, at(now));

  it("is open from 2 hours before the start until the end", () => {
    expect(door({}, "2026-12-03T02:30:00.000Z")).toEqual({ kind: "open" });
    expect(door({}, "2026-12-03T05:14:59.999Z")).toEqual({ kind: "open" });
  });

  it("is not open yet just before, and says when it opens", () => {
    expect(door({}, "2026-12-03T02:29:59.999Z")).toEqual({
      kind: "not-open",
      opensAt: at("2026-12-03T02:30:00.000Z"),
    });
  });

  it("is closed from the moment the session ends", () => {
    expect(door({}, "2026-12-03T05:15:00.000Z")).toEqual({ kind: "closed" });
  });

  it("checks the event first, then the session", () => {
    expect(door({ eventStatus: "draft" })).toEqual({ kind: "event-draft" });
    expect(door({ eventStatus: "cancelled", status: "cancelled" })).toEqual({
      kind: "event-cancelled",
    });
    expect(door({ status: "cancelled" })).toEqual({ kind: "cancelled" });
    expect(door({ status: "draft" })).toEqual({ kind: "unscheduled" });
    expect(door({ startAt: null, endAt: null })).toEqual({
      kind: "unscheduled",
    });
  });

  it("in dev (a year early) a session weeks away is open", () => {
    expect(door({}, "2026-11-20T10:00:00.000Z", 24 * 365)).toEqual({
      kind: "open",
    });
  });
});
