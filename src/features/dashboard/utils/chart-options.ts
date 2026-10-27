import type { BarSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import type { ChartPalette } from "@/src/core/charts/chart-palette";
import type { WeeklySignups } from "../types/admin-overview";

// Pure option builders: data + theme colours in, ECharts option out. No DOM, so they are
// unit-tested directly; the EChart component only draws what they return.

export type BarChartOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

const WEEK_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "2026-10-20" → "20 Oct" (en-GB writes September as "Sept"). */
export function formatWeekLabel(weekStart: string): string {
  return WEEK_LABEL.format(new Date(`${weekStart}T00:00:00Z`));
}

/** New sign-ups per week: attendees and organizer applications stacked in one bar. */
export function buildWeeklySignupsOption(
  weeks: readonly WeeklySignups[],
  palette: ChartPalette,
): BarChartOption {
  return {
    // The card draws its own legend (same as the design); this one stays hidden.
    legend: { show: false },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: weeks.map((week) => formatWeekLabel(week.weekStart)),
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
        name: "Attendees",
        type: "bar",
        stack: "signups",
        data: weeks.map((week) => week.attendees),
        itemStyle: { color: palette.brand },
        emphasis: { focus: "series" },
      },
      {
        name: "Organizer applications",
        type: "bar",
        stack: "signups",
        data: weeks.map((week) => week.organizerApplications),
        itemStyle: { color: palette.warning, borderRadius: [2, 2, 0, 0] },
        emphasis: { focus: "series" },
      },
    ],
  };
}
