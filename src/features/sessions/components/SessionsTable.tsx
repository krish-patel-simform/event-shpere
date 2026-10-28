import { Eye } from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/src/core/format/format-number";
import {
  ActionMenu,
  Badge,
  Button,
  buttonStyles,
  ClickableRow,
  cn,
  TablePagination,
} from "@/src/core/ui";
import { SESSION_ROUTES, sessionHref } from "../routes";
import type { SessionItem } from "../types/session";
import {
  ALMOST_FULL_PERCENT,
  fillPercent,
  formatDayFull,
  formatTimeRange,
  sessionStatusBadge,
  sessionSubline,
} from "../utils/session-display";

const TH = "px-4 py-2.5 font-semibold";

type SessionsTableProps = {
  /** The sessions of this page, already filtered and sorted. */
  sessions: readonly SessionItem[];
  /** Sessions matching the filters, over all pages. */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** A tab or filter is active, so an empty list means "no match". */
  isFiltered: boolean;
  onClearFilters: () => void;
};

/** The speaker's sessions: one row per session, the whole row opens its page. */
export function SessionsTable({
  sessions,
  total,
  page,
  pageSize,
  onPageChange,
  isFiltered,
  onClearFilters,
}: SessionsTableProps) {
  if (sessions.length === 0) {
    return isFiltered ? (
      <div className="space-y-3 px-5 py-10 text-center">
        <p className="text-muted">No sessions match your filters.</p>
        <Button variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    ) : (
      <div className="space-y-3 px-5 py-10 text-center">
        <p className="text-muted">You have no sessions yet.</p>
        <Link
          href={SESSION_ROUTES.create}
          className={buttonStyles({ variant: "primary" })}
        >
          Submit your first session
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Your sessions</caption>
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className={TH}>
                Session
              </th>
              <th scope="col" className={TH}>
                Event
              </th>
              <th scope="col" className={cn(TH, "whitespace-nowrap")}>
                Date &amp; time (UTC)
              </th>
              <th scope="col" className={TH}>
                Room
              </th>
              <th scope="col" className={TH}>
                Registrations
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const status = sessionStatusBadge(session.status);
              return (
                <ClickableRow
                  key={session.id}
                  className="border-t border-line align-middle"
                >
                  <td className="min-w-64 px-4 py-3">
                    <Link
                      href={sessionHref(session.id)}
                      data-row-link
                      className="font-semibold hover:underline"
                    >
                      {session.title}
                    </Link>
                    <p className="text-muted">{sessionSubline(session)}</p>
                  </td>
                  <td className="px-4 py-3">{session.eventName}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <When session={session} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {session.room ?? <Dash />}
                  </td>
                  <td className="min-w-36 px-4 py-3">
                    <Demand session={session} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone} className="gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                      />
                      {status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      label={`Actions for ${session.title}`}
                      items={[
                        {
                          label: "View session",
                          href: sessionHref(session.id),
                          icon: Eye,
                        },
                      ]}
                    />
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        itemCount={sessions.length}
        onPageChange={onPageChange}
      />
    </>
  );
}

/** A dash for "nothing here", with a text a screen reader can read. */
function Dash() {
  return (
    <>
      <span aria-hidden="true" className="text-muted">
        —
      </span>
      <span className="sr-only">None</span>
    </>
  );
}

function When({ session }: { session: SessionItem }) {
  if (!session.startsAt || !session.endsAt) {
    return <span className="text-muted">Not yet scheduled</span>;
  }
  return (
    <>
      {formatDayFull(session.startsAt)}
      <p className="text-muted">
        {formatTimeRange(session.startsAt, session.endsAt)}
      </p>
    </>
  );
}

/** Seats taken with a bar (and the numbers: the bar is never the only signal), or who attended. */
function Demand({ session }: { session: SessionItem }) {
  if (session.registrations) {
    const { registered, capacity } = session.registrations;
    const percent = fillPercent(registered, capacity);
    const almostFull = percent >= ALMOST_FULL_PERCENT;
    return (
      <>
        <p className="mb-1">
          {formatCount(registered)} / {formatCount(capacity)}
          {almostFull && <span className="text-warning"> · Almost full</span>}
        </p>
        <div
          role="progressbar"
          aria-label={`Seats taken for ${session.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 rounded-full bg-surface-subtle"
        >
          <div
            style={{ width: `${percent}%` }}
            className={cn(
              "h-full rounded-full",
              almostFull ? "bg-warning" : "bg-brand",
            )}
          />
        </div>
      </>
    );
  }
  if (session.attended !== null) {
    return <>{formatCount(session.attended)} attended</>;
  }
  return <Dash />;
}
