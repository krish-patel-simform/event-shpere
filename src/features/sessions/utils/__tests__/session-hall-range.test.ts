import { toSessionHallRange } from "../session-hall-range";

const slot = { date: "2026-12-04", startTime: "10:00", endTime: "11:00" };

describe("toSessionHallRange", () => {
  it("turns the date and times into the range to ask about, with the event's offset", () => {
    expect(toSessionHallRange(slot)).toEqual({
      startAt: "2026-12-04T10:00:00+05:30",
      endAt: "2026-12-04T11:00:00+05:30",
    });
  });

  it.each([
    ["no date", { ...slot, date: "" }],
    ["no start time", { ...slot, startTime: "" }],
    ["no end time", { ...slot, endTime: "" }],
  ])("is null with %s, so nothing is asked", (_name, values) => {
    expect(toSessionHallRange(values)).toBeNull();
  });

  it("is null when the end is not after the start: the server would refuse it", () => {
    expect(toSessionHallRange({ ...slot, endTime: "10:00" })).toBeNull();
    expect(toSessionHallRange({ ...slot, endTime: "09:00" })).toBeNull();
  });

  it("is null for a date that is only half typed", () => {
    expect(toSessionHallRange({ ...slot, date: "2026-12" })).toBeNull();
  });
});
