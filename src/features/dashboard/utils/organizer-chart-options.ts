import type { ChartPalette } from "@/src/core/charts/chart-palette";
import type { DailyRegistrations } from "../types/organizer-home";
import { formatWeekLabel, type BarChartOption } from "./chart-options";

// Pure option builders for the organizer dashboard: data + theme colours in, ECharts option out.
// No DOM, so they are unit-tested directly; the EChart component only draws what they return.

/** "2026-10-20" → "20 Oct": the same label the admin chart uses for its week starts. */
export const formatDayLabel = formatWeekLabel;

/** The busiest day (the first one on a tie); null when there are no days. */
export function findPeakDay(
  days: readonly DailyRegistrations[],
): DailyRegistrations | null {
  let peak: DailyRegistrations | null = null;
  for (const day of days) {
    if (peak === null || day.count > peak.count) peak = day;
  }
  return peak;
}

/** Registrations per day: one bar a day, the busiest day in full colour and labelled. */
export function buildDailyRegistrationsOption(
  days: readonly DailyRegistrations[],
  palette: ChartPalette,
): BarChartOption {
  const peak = findPeakDay(days);

  return {
    legend: { show: false },
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: days.map((day) => formatDayLabel(day.date)),
      axisLine: { lineStyle: { color: palette.line } },
      axisTick: { show: false },
      axisLabel: { color: palette.muted },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: palette.muted },
      splitLine: { lineStyle: { color: palette.line } },
    },
    series: [
      {
        name: "Registrations",
        type: "bar",
        data: days.map((day) => {
          const isPeak = day === peak;
          return {
            value: day.count,
            itemStyle: {
              color: palette.brand,
              opacity: isPeak ? 1 : 0.5,
              borderRadius: [2, 2, 0, 0],
            },
            label: {
              show: isPeak,
              position: "top",
              color: palette.foreground,
              fontWeight: "bold",
            },
          };
        }),
        emphasis: { focus: "series" },
      },
    ],
  };
}
