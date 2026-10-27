import type { ChartPalette } from "@/src/core/charts/chart-palette";
import { buildWeeklySignupsOption, formatWeekLabel } from "../chart-options";

const palette: ChartPalette = {
  brand: "rgb(29, 78, 143)",
  warning: "rgb(122, 74, 10)",
  success: "rgb(23, 101, 58)",
  danger: "rgb(179, 38, 30)",
  muted: "rgb(81, 92, 107)",
  line: "rgb(211, 216, 224)",
  foreground: "rgb(20, 27, 39)",
  surface: "rgb(255, 255, 255)",
};

const weeks = [
  { weekStart: "2026-09-01", attendees: 41, organizerApplications: 1 },
  { weekStart: "2026-09-08", attendees: 50, organizerApplications: 0 },
];

describe("formatWeekLabel", () => {
  it("prints day and short month in UTC, whatever the local time zone", () => {
    // en-GB abbreviates September as "Sept".
    expect(formatWeekLabel("2026-09-01")).toBe("1 Sept");
    expect(formatWeekLabel("2026-10-20")).toBe("20 Oct");
  });
});

describe("buildWeeklySignupsOption", () => {
  const option = buildWeeklySignupsOption(weeks, palette);
  const series = option.series as {
    name: string;
    stack: string;
    data: number[];
    itemStyle: { color: string };
  }[];

  it("one category per week, labelled by its first day", () => {
    expect(option.xAxis).toMatchObject({ data: ["1 Sept", "8 Sept"] });
  });

  it("stacks attendees and organizer applications in one bar per week", () => {
    expect(series.map((s) => s.name)).toEqual([
      "Attendees",
      "Organizer applications",
    ]);
    expect(series[0].stack).toBe(series[1].stack);
    expect(series[0].data).toEqual([41, 50]);
    expect(series[1].data).toEqual([1, 0]);
  });

  it("takes its colours from the theme palette", () => {
    expect(series[0].itemStyle.color).toBe(palette.brand);
    expect(series[1].itemStyle.color).toBe(palette.warning);
  });
});
