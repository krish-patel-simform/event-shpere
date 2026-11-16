import { formatSlot } from "../hall-slot";

describe("formatSlot", () => {
  it("writes a slot on one day as date, then the two times", () => {
    // 04:30 and 06:30 UTC are 10:00 and 12:00 in India.
    expect(
      formatSlot(
        "2026-12-12T04:30:00.000Z",
        "2026-12-12T06:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toBe("12 Dec, 10:00–12:00");
  });

  it("shows both dates when the slot runs past midnight", () => {
    // 16:30 UTC is 22:00 IST; 20:30 UTC is 02:00 IST the next day.
    expect(
      formatSlot(
        "2026-12-12T16:30:00.000Z",
        "2026-12-12T20:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toBe("12 Dec 22:00 – 13 Dec 02:00");
  });

  it("shows the times in the venue's zone, not in UTC", () => {
    const slot = [
      "2026-12-12T04:30:00.000Z",
      "2026-12-12T06:30:00.000Z",
    ] as const;

    expect(formatSlot(...slot, "UTC")).toBe("12 Dec, 04:30–06:30");
    expect(formatSlot(...slot, "Asia/Kolkata")).toBe("12 Dec, 10:00–12:00");
  });

  it("writes midnight as 00:00, never 24:00", () => {
    expect(
      formatSlot(
        "2026-12-11T18:30:00.000Z", // 00:00 IST on 12 Dec
        "2026-12-11T19:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toBe("12 Dec, 00:00–01:00");
  });
});
