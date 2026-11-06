import { addYearsToDateKey, fromDateKey, toDateKey } from "../date-key";

describe("toDateKey", () => {
  it("writes the day with a zero-padded month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 12))).toBe("2026-12-12");
  });
});

describe("fromDateKey", () => {
  it("reads a real day back as local midnight", () => {
    const date = fromDateKey("2026-12-12");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(11);
    expect(date?.getDate()).toBe(12);
    expect(date?.getHours()).toBe(0);
  });

  it("round-trips with toDateKey", () => {
    expect(toDateKey(fromDateKey("2028-02-29")!)).toBe("2028-02-29");
  });

  it("is null for text that is not a real day", () => {
    expect(fromDateKey("")).toBeNull();
    expect(fromDateKey("tomorrow")).toBeNull();
    expect(fromDateKey("2026-12-1")).toBeNull();
    expect(fromDateKey("2026-02-31")).toBeNull();
    expect(fromDateKey("2027-02-29")).toBeNull();
    expect(fromDateKey("2026-13-01")).toBeNull();
  });
});

describe("addYearsToDateKey", () => {
  it("is the same day some years later", () => {
    expect(addYearsToDateKey("2026-11-06", 10)).toBe("2036-11-06");
  });

  it("lands 29 February on 28 February in a year without one", () => {
    expect(addYearsToDateKey("2028-02-29", 1)).toBe("2029-02-28");
    expect(addYearsToDateKey("2028-02-29", 4)).toBe("2032-02-29");
  });

  it("is null for text that is not a real day", () => {
    expect(addYearsToDateKey("nope", 10)).toBeNull();
  });
});
