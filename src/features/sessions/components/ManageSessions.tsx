"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { Alert, Badge, Button, cn, SourceBadge } from "@/src/core/ui";
import { EVENT_ROUTES } from "@/src/features/events";
import { ADMIN_SESSIONS_SAMPLE } from "../sample/admin-sessions-sample";
import {
  SESSION_MODE_LABELS,
  SESSION_STATUS_META,
  SESSION_TYPE_LABELS,
} from "../utils/organizer-session-display";

const TH = "px-4 py-2.5 font-semibold";
const STATIC_SELECT_CLASS =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm disabled:text-muted";

const STATIC_FILTERS = [
  { key: "status", label: "Status", option: "All statuses" },
  { key: "event", label: "Event", option: "All events" },
  { key: "organizer", label: "Organizer", option: "Any organizer" },
  { key: "format", label: "Format", option: "Any format" },
  { key: "type", label: "Type", option: "Any type" },
] as const;

/**
 * The admin's "Manage sessions" page (design board AdminSessions): every session of every event.
 * There is no API that lists sessions across events yet, so the whole page is STATIC: sample
 * rows, switched-off filters, and rows that open nothing (their ids are not real). The way to a
 * real session today is Manage events → an event → Sessions, which the notice links to.
 */
export function ManageSessions() {
  const filterId = useId();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Manage sessions</h1>
          <p className="max-w-xl text-muted">
            Every session from every event and organizer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled>
            <Download aria-hidden="true" className="size-4" />
            Export CSV
          </Button>
          <SourceBadge source="static" />
        </div>
      </header>

      <Alert tone="info" title="Sample data">
        <span className="flex flex-wrap items-center gap-2">
          <SourceBadge source="static" />
          These rows are examples: there is no API that lists every session yet.
          To open a real session and see who booked it, go to{" "}
          <Link href={EVENT_ROUTES.manage} className="font-semibold underline">
            Manage events
          </Link>
          , open an event, then its Sessions tab.
        </span>
      </Alert>

      <div role="search" className="flex flex-wrap items-center gap-2.5">
        {STATIC_FILTERS.map((filter) => (
          <span key={filter.key}>
            <label htmlFor={`${filterId}-${filter.key}`} className="sr-only">
              {filter.label}
            </label>
            <select
              id={`${filterId}-${filter.key}`}
              disabled
              className={STATIC_SELECT_CLASS}
            >
              <option>{filter.option}</option>
            </select>
          </span>
        ))}
        <SourceBadge source="static" />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Sample sessions from every event (static)
            </caption>
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className={TH}>
                  Session
                </th>
                <th scope="col" className={TH}>
                  Event
                </th>
                <th scope="col" className={TH}>
                  Where
                </th>
                <th scope="col" className={cn(TH, "whitespace-nowrap")}>
                  Time
                </th>
                <th scope="col" className={cn(TH, "whitespace-nowrap")}>
                  Seats taken
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_SESSIONS_SAMPLE.map((session) => {
                const status = SESSION_STATUS_META[session.status];
                const full =
                  session.seats !== null &&
                  session.seats.taken >= session.seats.of;
                return (
                  <tr
                    key={session.id}
                    className="border-t border-line align-middle"
                  >
                    <td className="min-w-64 px-4 py-3">
                      <p className="font-semibold">{session.title}</p>
                      <p className="text-muted">
                        {SESSION_TYPE_LABELS[session.type]} ·{" "}
                        {SESSION_MODE_LABELS[session.mode]}
                      </p>
                    </td>
                    <td className="min-w-48 px-4 py-3">
                      <p>{session.event}</p>
                      <p className="text-muted">{session.organizer}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {session.where ?? (
                        <span className="text-muted">Not placed</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {session.when ?? (
                        <span className="text-muted">Not scheduled</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {session.seats === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {formatCount(session.seats.taken)} /{" "}
                          {formatCount(session.seats.of)}
                          {full && <Badge tone="warning">Full</Badge>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          {ADMIN_SESSIONS_SAMPLE.length} sample sessions
        </p>
      </div>
    </div>
  );
}
