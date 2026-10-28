"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { ChartPalette } from "@/src/core/charts/chart-palette";
import { formatCount } from "@/src/core/format/format-number";
import { Badge, Card } from "@/src/core/ui";
import type { DailyRegistrationsData } from "../../types/organizer-home";
import {
  buildDailyRegistrationsOption,
  findPeakDay,
  formatDayLabel,
} from "../../utils/organizer-chart-options";

const CHART_HEIGHT = "h-48";

function ChartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className={`${CHART_HEIGHT} animate-pulse rounded bg-surface-subtle motion-reduce:animate-none`}
    />
  );
}

// ECharts needs the DOM: loaded in the browser only, with a skeleton until it is ready.
const EChart = dynamic(
  () => import("@/src/core/charts/EChart").then((module) => module.EChart),
  { ssr: false, loading: ChartSkeleton },
);

/** The sentence a screen reader hears for the chart. */
function describe(days: DailyRegistrationsData["days"]): string {
  const counts = days.map((day) => day.count);
  const peak = findPeakDay(days);
  return (
    `Daily registrations from ${formatDayLabel(days[0].date)} to ${formatDayLabel(days[days.length - 1].date)}, ` +
    `ranging from ${formatCount(Math.min(...counts))} to ${formatCount(Math.max(...counts))} per day` +
    (peak ? `, peaking on ${formatDayLabel(peak.date)}.` : ".")
  );
}

function changeBadge(changePct: number, days: number) {
  const period = `previous ${days} days`;
  if (changePct > 0) {
    return (
      <Badge tone="success">
        ▲ {changePct}% vs {period}
      </Badge>
    );
  }
  if (changePct < 0) {
    return (
      <Badge tone="warning">
        ▼ {Math.abs(changePct)}% vs {period}
      </Badge>
    );
  }
  return <Badge>Same as {period}</Badge>;
}

/** Registrations per day across the organizer's published events (ECharts bars). */
export function DailyRegistrationsChart({
  data,
}: {
  data: DailyRegistrationsData;
}) {
  const { days, changePct } = data;
  const getOption = useCallback(
    (palette: ChartPalette) => buildDailyRegistrationsOption(days, palette),
    [days],
  );
  const isEmpty = days.every((day) => day.count === 0);

  return (
    <Card
      title="Registrations per day"
      description={`All published events · last ${days.length} days`}
      action={days.length > 0 ? changeBadge(changePct, days.length) : undefined}
    >
      {days.length === 0 || isEmpty ? (
        <p
          className={`${CHART_HEIGHT} grid place-items-center text-center text-muted`}
        >
          No registrations in this period.
        </p>
      ) : (
        <>
          <EChart
            getOption={getOption}
            ariaLabel={describe(days)}
            className={CHART_HEIGHT}
          />
          {/*
            The exact numbers for screen readers; the chart above is for the eye. `sr-only` is on
            a <div>, not on the <table>: a table ignores the overflow clipping sr-only relies on,
            so its rows spilled out of the 1px box and stretched the page below the layout.
          */}
          <div className="sr-only">
            <table>
              <caption>Registrations per day</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Registrations</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{formatDayLabel(day.date)}</th>
                    <td>{formatCount(day.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
