"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { ChartPalette } from "@/src/core/charts/chart-palette";
import type { WeeklySignups } from "../../types/admin-overview";
import {
  buildWeeklySignupsOption,
  formatWeekLabel,
} from "../../utils/chart-options";
import { formatCount } from "@/src/core/format/format-number";

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

const SERIES = [
  { label: "Attendees", swatch: "bg-brand" },
  { label: "Organizer applications", swatch: "bg-warning" },
] as const;

/** The sentence a screen reader hears for the chart. */
function describe(weeks: readonly WeeklySignups[]): string {
  const attendees = weeks.map((week) => week.attendees);
  const applications = weeks.map((week) => week.organizerApplications);
  return (
    `New sign-ups over the last ${weeks.length} weeks: ` +
    `attendees from ${formatCount(attendees[0])} to ${formatCount(attendees[attendees.length - 1])}, ` +
    `${Math.min(...applications)} to ${Math.max(...applications)} organizer applications per week.`
  );
}

export function WeeklySignupsChart({
  weeks,
}: {
  weeks: readonly WeeklySignups[];
}) {
  const getOption = useCallback(
    (palette: ChartPalette) => buildWeeklySignupsOption(weeks, palette),
    [weeks],
  );
  const isEmpty = weeks.every(
    (week) => week.attendees === 0 && week.organizerApplications === 0,
  );

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-semibold">New sign-ups per week</h2>
          <p className="text-sm text-muted">Last {weeks.length} weeks</p>
        </div>
        <ul className="flex flex-wrap gap-3.5 text-sm">
          {SERIES.map(({ label, swatch }) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-3 rounded-sm ${swatch}`}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-5">
        {weeks.length === 0 || isEmpty ? (
          <p
            className={`${CHART_HEIGHT} grid place-items-center text-center text-muted`}
          >
            No sign-ups in this period.
          </p>
        ) : (
          <>
            <EChart
              getOption={getOption}
              ariaLabel={describe(weeks)}
              className={CHART_HEIGHT}
            />
            {/* The exact numbers for screen readers; the chart above is for the eye. */}
            <table className="sr-only">
              <caption>New sign-ups per week</caption>
              <thead>
                <tr>
                  <th scope="col">Week of</th>
                  <th scope="col">Attendees</th>
                  <th scope="col">Organizer applications</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week.weekStart}>
                    <th scope="row">{formatWeekLabel(week.weekStart)}</th>
                    <td>{formatCount(week.attendees)}</td>
                    <td>{formatCount(week.organizerApplications)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
