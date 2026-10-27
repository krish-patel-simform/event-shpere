import Link from "next/link";
import type {
  EventStatus,
  EventStatusCounts,
  RoleCounts,
} from "../../types/admin-overview";
import { formatCount } from "../../utils/format-number";
import { roleLabel } from "../../utils/role-label";

const STATUSES: readonly {
  status: EventStatus;
  label: string;
  swatch: string;
}[] = [
  { status: "published", label: "Published", swatch: "bg-success" },
  { status: "draft", label: "Draft", swatch: "bg-field" },
  { status: "completed", label: "Completed", swatch: "bg-brand" },
  { status: "cancelled", label: "Cancelled", swatch: "bg-danger" },
];

const ROLES = ["user", "speaker", "organizer", "admin"] as const;

/** Share of `total` in percent; 0 when there is nothing to divide. */
function percent(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Two small meters: events by status (one stacked bar) and accounts by role (a bar each).
 * Plain CSS, not ECharts: they are progress bars, not charts. The numbers are always written
 * next to the bars, so nothing depends on colour or on seeing the bars.
 */
export function PlatformBreakdown({
  eventsByStatus,
  accountsByRole,
  usersHref,
}: {
  eventsByStatus: EventStatusCounts;
  accountsByRole: RoleCounts;
  usersHref: string;
}) {
  const totalEvents = STATUSES.reduce(
    (sum, { status }) => sum + eventsByStatus[status],
    0,
  );
  const largestRole = Math.max(...ROLES.map((role) => accountsByRole[role]));

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5">
      <div>
        <h2 className="mb-2.5 font-semibold">Events by status</h2>
        <div
          role="img"
          aria-label={`${formatCount(totalEvents)} events: ${STATUSES.map(
            ({ status, label }) =>
              `${formatCount(eventsByStatus[status])} ${label.toLowerCase()}`,
          ).join(", ")}`}
          className="flex h-3.5 gap-0.5 overflow-hidden rounded-sm bg-surface-subtle"
        >
          {STATUSES.map(({ status, swatch }) => (
            <span
              key={status}
              className={swatch}
              style={{
                width: `${percent(eventsByStatus[status], totalEvents)}%`,
              }}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {STATUSES.map(({ status, label, swatch }) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-sm ${swatch}`}
              />
              {label}
              <strong className="ml-auto">
                {formatCount(eventsByStatus[status])}
              </strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line pt-4">
        <h2 className="mb-2 font-semibold">Accounts by role</h2>
        <ul className="space-y-1">
          {ROLES.map((role) => (
            <li
              key={role}
              className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2.5 py-1 text-sm"
            >
              <span>{roleLabel(role)}</span>
              <span
                aria-hidden="true"
                className="h-2 rounded bg-surface-subtle"
              >
                <span
                  className="block h-full rounded bg-brand"
                  style={{
                    width: `${percent(accountsByRole[role], largestRole)}%`,
                  }}
                />
              </span>
              <strong className="text-right">
                {formatCount(accountsByRole[role])}
              </strong>
            </li>
          ))}
        </ul>
        <Link
          href={usersHref}
          className="mt-1.5 inline-block text-sm font-semibold text-link"
        >
          Manage users
        </Link>
      </div>
    </section>
  );
}
