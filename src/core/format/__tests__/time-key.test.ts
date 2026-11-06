import { formatTime12, fromMinutes, toMinutes } from "../time-key";

describe("toMinutes", () => {
  it("counts minutes since midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("is null for text that is not a time of day", () => {
    expect(toMinutes("")).toBeNull();
    expect(toMinutes("9:30")).toBeNull();
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("12:60")).toBeNull();
    expect(toMinutes("noon")).toBeNull();
  });
});

describe("fromMinutes", () => {
  it("writes minutes since midnight as a clock time", () => {
    expect(fromMinutes(0)).toBe("00:00");
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(1439)).toBe("23:59");
  });
});

describe("formatTime12", () => {
  it("reads a time out with AM or PM", () => {
    expect(formatTime12("00:00")).toBe("12:00 AM");
    expect(formatTime12("09:30")).toBe("9:30 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("17:45")).toBe("5:45 PM");
  });

  it("returns text that is not a time unchanged", () => {
    expect(formatTime12("soon")).toBe("soon");
  });
});
