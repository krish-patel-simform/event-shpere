"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  SourceBadge,
  TablePagination,
} from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";
import { formatDate } from "@/src/core/format/format-date";
import {
  SAMPLE_ATTENDEE_TOTALS,
  SAMPLE_ATTENDEES,
  SAMPLE_SESSIONS,
} from "../sample/organizer-sample";
import type { EventOverviewData } from "../types/event-manage.types";
import { plural } from "../utils/event-display";
import {
  ATTENDEE_STATUS_META,
  averageBookings,
  DEFAULT_ATTENDEE_FILTERS,
  filterAttendees,
  isFilteringAttendees,
  parseStatusFilter,
  type AttendeeFilters,
} from "../utils/event-attendees";
import { EventLoader } from "./EventLoader";
import { EventPageHeader } from "./EventPageHeader";
import { SearchBox } from "./SearchBox";
import { StaticDataNotice } from "./StaticDataNotice";

const PAGE_SIZE = 6;
const TH = "px-4 py-2.5 font-semibold";
const SELECT_CLASS =
  "rounded-md border border-field bg-surface px-3 py-2.5 text-sm";

/** Sessions an attendee can book: the ones that are not cancelled. */
const BOOKABLE = SAMPLE_SESSIONS.filter((session) => !session.cancelled);

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}

/**
 * The organizer's Attendees tab of one event: how many registered, cancelled and booked sessions,
 * and who they are, with a search and filters by session and status. The event's header is real;
 * the numbers and rows are sample data (Static) and Export CSV is switched off until the
 * registrations API exists.
 */
export function EventAttendees({ eventId }: { eventId: string }) {
  return (
    <EventLoader eventId={eventId}>
      {(overview) => <AttendeesPage overview={overview} />}
    </EventLoader>
  );
}

function AttendeesPage({ overview }: { overview: EventOverviewData }) {
  const sessionSelectId = useId();
  const statusSelectId = useId();
  const [filters, setFilters] = useState<AttendeeFilters>(
    DEFAULT_ATTENDEE_FILTERS,
  );
  const [page, setPage] = useState(1);

  const totals = SAMPLE_ATTENDEE_TOTALS;
  const matches = filterAttendees(SAMPLE_ATTENDEES, filters);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const session = BOOKABLE.find((item) => item.id === filters.sessionId);

  // Every filter change starts again from the first page.
  function change(next: Partial<AttendeeFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EventPageHeader overview={overview} current="attendees" />

      <StaticDataNotice>
        These attendees are examples. Nothing is loaded from the server yet.
      </StaticDataNotice>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Registered"
          value={formatCount(totals.registered)}
          note={`of ${formatCount(totals.seats)} seats`}
        />
        <Kpi
          label="Cancelled"
          value={formatCount(totals.cancelled)}
          note="registrations"
        />
        <Kpi
          label="Session bookings"
          value={formatCount(totals.sessionBookings)}
          note={`average ${averageBookings(totals.sessionBookings, totals.registered)} per attendee`}
        />
        <Kpi
          label="Checked in"
          value={formatCount(totals.checkedIn)}
          note="check-in is not built yet"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox
          label="Search attendees by name or email"
          value={filters.search}
          onChange={(search) => change({ search })}
        />
        <label htmlFor={sessionSelectId} className="sr-only">
          Session
        </label>
        <select
          id={sessionSelectId}
          value={filters.sessionId ?? ""}
          onChange={(event) =>
            change({ sessionId: event.target.value || null })
          }
          className={SELECT_CLASS}
        >
          <option value="">All registrations</option>
          {BOOKABLE.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <label htmlFor={statusSelectId} className="sr-only">
          Status
        </label>
        <select
          id={statusSelectId}
          value={filters.status}
          onChange={(event) =>
            change({ status: parseStatusFilter(event.target.value) })
          }
          className={SELECT_CLASS}
        >
          <option value="all">All statuses</option>
          <option value="registered">Registered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button variant="secondary" disabled>
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </Button>
        <SourceBadge source="static" />
      </div>

      <p className="text-sm text-muted">
        {session
          ? `${plural(matches.length, "registration")} ${matches.length === 1 ? "includes" : "include"} “${session.title}”.`
          : "Pick a session to see only the people who booked it."}
      </p>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {matches.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">
              {isFilteringAttendees(filters)
                ? "No attendee matches these filters."
                : "Nobody has registered yet."}
            </p>
            {isFilteringAttendees(filters) && (
              <Button
                variant="secondary"
                onClick={() => change(DEFAULT_ATTENDEE_FILTERS)}
              >
                Clear search and filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  People registered for this event
                </caption>
                <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className={TH}>
                      Attendee
                    </th>
                    <th scope="col" className={TH}>
                      Registered on
                    </th>
                    <th scope="col" className={TH}>
                      Sessions booked
                    </th>
                    <th scope="col" className={TH}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((attendee) => {
                    const status = ATTENDEE_STATUS_META[attendee.status];
                    return (
                      <tr
                        key={attendee.id}
                        className="border-t border-line align-middle"
                      >
                        <td className="min-w-56 px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={attendee.name} />
                            <div>
                              <p className="font-semibold">{attendee.name}</p>
                              <p className="text-muted">{attendee.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDate(attendee.registeredAt)}
                        </td>
                        <td className="px-4 py-3">
                          {attendee.sessionIds.length > 0 ? (
                            attendee.sessionIds.length
                          ) : (
                            <span className="text-muted">None</span>
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
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={matches.length}
              itemCount={visible.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
