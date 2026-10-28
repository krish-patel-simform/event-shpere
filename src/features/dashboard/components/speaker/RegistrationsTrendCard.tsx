import { Card } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import type { RegistrationTrend } from "../../types/speaker-home";
import { formatDayMonth, percentOf } from "../../utils/home-format";
import { EmptyState } from "../EmptyState";

const CHART_HEIGHT = "h-40";

/** Midday UTC, so formatting the date in any time zone gives the same day. */
const atNoon = (isoDate: string) => `${isoDate}T12:00:00Z`;

function Figure({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "success";
}) {
  return (
    <div>
      <p
        className={`text-2xl font-semibold ${tone === "success" ? "text-success" : ""}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/**
 * Registrations across the speaker's sessions, cumulative, one bar per day. Plain CSS bars (a
 * running total from zero), with the numbers written above and in a hidden table.
 */
export function RegistrationsTrendCard({
  trend,
}: {
  trend: RegistrationTrend;
}) {
  const { points, note } = trend;

  if (points.length < 2) {
    return (
      <Card title="Registrations across your sessions" flush>
        <EmptyState>No registrations yet.</EmptyState>
      </Card>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const gained = last.total - first.total;
  const perDay = Math.round(gained / (points.length - 1));
  const peak = Math.max(...points.map((point) => point.total));
  const firstLabel = formatDayMonth(atNoon(first.date));
  const lastLabel = formatDayMonth(atNoon(last.date));

  return (
    <Card
      title="Registrations across your sessions"
      description={`Cumulative, last ${points.length} days`}
    >
      <div className="mb-4 flex flex-wrap gap-7">
        <Figure value={formatCount(last.total)} label="Registered now" />
        <Figure
          value={`+${formatCount(gained)}`}
          label="In this period"
          tone="success"
        />
        <Figure value={formatCount(perDay)} label="Avg. per day" />
      </div>

      <div
        role="img"
        aria-label={`Registrations grew from ${formatCount(first.total)} on ${firstLabel} to ${formatCount(last.total)} on ${lastLabel}`}
        className={`flex ${CHART_HEIGHT} items-end gap-1 border-b border-field`}
      >
        {points.map((point) => (
          <div
            key={point.date}
            className={`flex-1 rounded-t-sm ${point.date === note?.date ? "bg-brand" : "bg-brand/50"}`}
            style={{ height: `${percentOf(point.total, peak)}%` }}
          />
        ))}
      </div>
      <p
        aria-hidden="true"
        className="mt-1.5 flex justify-between text-xs text-muted"
      >
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </p>

      {/* Exact numbers for screen readers. `sr-only` on the wrapping div, never on the table. */}
      <div className="sr-only">
        <table>
          <caption>Registrations across your sessions, by day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Registered</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row">{formatDayMonth(atNoon(point.date))}</th>
                <td>{formatCount(point.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note && (
        <p className="mt-3.5 rounded-md border border-line bg-surface-subtle px-3 py-2.5 text-sm">
          <strong>{formatDayMonth(atNoon(note.date))}:</strong> {note.text}
        </p>
      )}
    </Card>
  );
}
