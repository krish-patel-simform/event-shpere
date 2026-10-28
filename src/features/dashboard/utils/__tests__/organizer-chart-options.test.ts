import type { ChartPalette } from "@/src/core/charts/chart-palette";
import {
  buildDailyRegistrationsOption,
  findPeakDay,
} from "../organizer-chart-options";

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

const days = [
  { date: "2026-10-18", count: 40 },
  { date: "2026-10-19", count: 90 },
  { date: "2026-10-20", count: 90 },
];

describe("findPeakDay", () => {
  it("the busiest day, the first one on a tie", () => {
    expect(findPeakDay(days)).toBe(days[1]);
  });

  it("no days: null", () => {
    expect(findPeakDay([])).toBeNull();
  });
});

describe("buildDailyRegistrationsOption", () => {
  const option = buildDailyRegistrationsOption(days, palette);
  const series = option.series as {
    type: string;
    data: {
      value: number;
      itemStyle: { color: string; opacity: number };
      label: { show: boolean };
    }[];
  }[];

  it("one bar per day, labelled by date", () => {
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe("bar");
    expect(series[0].data.map((item) => item.value)).toEqual([40, 90, 90]);
    expect(option.xAxis).toMatchObject({
      data: ["18 Oct", "19 Oct", "20 Oct"],
    });
  });

  it("the busiest day is in full colour and labelled, the others are lighter", () => {
    expect(series[0].data.map((item) => item.itemStyle.opacity)).toEqual([
      0.5, 1, 0.5,
    ]);
    expect(series[0].data.map((item) => item.label.show)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("takes its colours from the theme palette", () => {
    expect(series[0].data[0].itemStyle.color).toBe(palette.brand);
  });
});
