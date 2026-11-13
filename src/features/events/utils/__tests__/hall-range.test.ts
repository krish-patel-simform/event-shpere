import { toHallAvailabilityRange } from "../hall-range";

const filled = {
  startDate: "2026-12-12",
  startTime: "09:00",
  endDate: "2026-12-13",
  endTime: "17:00",
};

describe("toHallAvailabilityRange", () => {
  it("builds the range in India's offset from the four inputs", () => {
    expect(toHallAvailabilityRange(filled)).toEqual({
      startAt: "2026-12-12T09:00:00+05:30",
      endAt: "2026-12-13T17:00:00+05:30",
    });
  });

  it.each(["startDate", "startTime", "endDate", "endTime"] as const)(
    "is null while %s is empty, so nothing is requested",
    (field) => {
      expect(toHallAvailabilityRange({ ...filled, [field]: "" })).toBeNull();
    },
  );

  it("is null when the end is not after the start", () => {
    expect(
      toHallAvailabilityRange({
        ...filled,
        endDate: "2026-12-12",
        endTime: "09:00",
      }),
    ).toBeNull();
    expect(
      toHallAvailabilityRange({ ...filled, endDate: "2026-12-11" }),
    ).toBeNull();
  });

  it("accepts an event that ends later the same day", () => {
    expect(
      toHallAvailabilityRange({ ...filled, endDate: "2026-12-12" }),
    ).not.toBeNull();
  });

  it("is null for a range longer than the server answers (31 days)", () => {
    expect(
      toHallAvailabilityRange({
        ...filled,
        startDate: "2026-12-01",
        endDate: "2027-01-05",
      }),
    ).toBeNull();
  });

  it("is null for a date that does not exist", () => {
    expect(
      toHallAvailabilityRange({ ...filled, startDate: "2026-13-45" }),
    ).toBeNull();
  });
});
