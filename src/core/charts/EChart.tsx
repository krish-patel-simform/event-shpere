"use client";

// Load this file with next/dynamic and { ssr: false } from a Client Component: ECharts needs the
// DOM, and the dynamic import keeps it out of every page that has no chart.
import { BarChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { subscribeThemePreference } from "../theme/theme";
import { resolveChartPalette, type ChartPalette } from "./chart-palette";

// Only what the charts use (tree-shaken); importing "echarts" itself would ship the whole library.
// Add LineChart / PieChart here when a chart needs them.
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);

export type EChartOption = echarts.EChartsCoreOption;

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** "dark" or "light": the user's choice (data-theme) or else the operating system's. */
function getColorScheme(): "dark" | "light" {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribeColorScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  const unsubscribeTheme = subscribeThemePreference(onChange);
  return () => {
    query.removeEventListener("change", onChange);
    unsubscribeTheme();
  };
}

type EChartProps = {
  /**
   * Builds the option from the theme's colours. Keep it stable (useCallback or a module-level
   * function): a new function on every render redraws the chart every render.
   */
  getOption: (palette: ChartPalette) => EChartOption;
  /** What the chart shows, in words, for screen readers. */
  ariaLabel: string;
  /** Give the chart a height here (e.g. "h-48"): ECharts draws into the box it is given. */
  className?: string;
};

/** One ECharts instance: created on mount, resized with its box, disposed on unmount. */
export function EChart({ getOption, ariaLabel, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  // Changes when the theme changes, so the colours are resolved again.
  const colorScheme = useSyncExternalStore(
    subscribeColorScheme,
    getColorScheme,
    () => "light",
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;
    chart.setOption(
      {
        ...getOption(resolveChartPalette(container)),
        // ECharts writes this description onto the chart for screen readers.
        aria: { enabled: true, label: { description: ariaLabel } },
      },
      { notMerge: true },
    );
  }, [getOption, ariaLabel, colorScheme]);

  // aria-label here too, so the chart has a name before ECharts has drawn it.
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
    />
  );
}
