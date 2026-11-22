"use client";

import { useId, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { Download } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Kpi,
  SearchBox,
  SourceBadge,
  TablePagination,
} from "@/src/core/ui";
import { useGetEventAttendeeCounts } from "../hooks/useGetEventAttendeeCounts";
import { useGetEventAttendees } from "../hooks/useGetEventAttendees";
import type {
  AttendeeCounts,
  AttendeeDto,
  attendeeSorts,
} from "../schemas/attendees.schemas";
import {
  CHECKED_IN_OPTIONS,
  FilterSelect as Select,
  LIST_PAGE_SIZE,
  LIST_SEARCH_DELAY_MS,
  ListError,
  ListSkeleton,
  RefreshButton,
  SELECT_CLASS,
  sortOptions,
  STATUS_OPTIONS,
  TH,
} from "./attendee-list-parts";
import {
  attendeeStatus,
  averageBookings,
  checkedInByLine,
  checkedInPercent,
  eventDays,
  isFilteringAttendees,
  type AttendeeRowFilters,
} from "../utils/attendee-display";

const PAGE_SIZE = LIST_PAGE_SIZE;
const SORT_OPTIONS = sortOptions("Registered");

/** What the list needs to know about its event (from the organizer's overview). */
export type AttendeeListEvent = {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  /** null = no seat limit. */
  capacity: number | null;
  /** Seats booked across the event's sessions (the overview's figure). */
  sessionBookings: number;
};

type Filters = AttendeeRowFilters & {
  sort: (typeof attendeeSorts)[number];
  /** "2026-12-03", or "" = all days. */
  date: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "all",
  checkedIn: "all",
  sort: "newest",
  date: "",
};

/** The "Checked in" cell: when and by whom, "Not checked in", or nothing to say for a cancelled one. */
function CheckedInCell({
  attendee,
  timezone,
}: {
  attendee: AttendeeDto;
  timezone: string;
}) {
  if (attendee.checkedInAt) {
    const by = checkedInByLine(attendee);
    return (
      <>
        <span className="whitespace-nowrap">
          {formatZonedDateTime(attendee.checkedInAt, timezone)}
        </span>
        {by && <p className="text-muted">{by}</p>}
      </>
    );
  }
  return (
    <span className="text-muted">
      {attendee.status === "cancelled" ? "Not applicable" : "Not checked in"}
    </span>
  );
}

/**
 * Who registered for one event (route 5), for its organizer or an admin: counts, then a table
 * searched, filtered, sorted and paged by the server. On a multi-day event, "Event day" makes
 * the check-ins and the counts mean that day ("pending on day 2"). The counts cover the whole
 * event, so they do not move while the organizer types a search. Checking people in is the
 * Check-in tab (EventCheckInDesk), not this list.
 */
export function EventAttendeeList({ event }: { event: AttendeeListEvent }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const sessionSelectId = useId();
  // The box updates at once; the API is asked once the organizer stops typing.
  const search = useDebouncedValue(filters.search.trim(), LIST_SEARCH_DELAY_MS);
  const days = eventDays(event.startAt, event.endAt, event.timezone);
  const day = days.find((item) => item.key === filters.date);

  const list = useGetEventAttendees(event.id, {
    page,
    pageSize: PAGE_SIZE,
    status: filters.status,
    checkedIn: filters.checkedIn,
    sort: filters.sort,
    search,
    date: filters.date || undefined,
  });

  // Every change starts again from the first page.
  function change(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  // Read on their own: a search, a filter, a sort or a page asks only for new rows, so the cards
  // keep their numbers. Only a new event day asks for new counts.
  const countsQuery = useGetEventAttendeeCounts(
    event.id,
    filters.date || undefined,
  );
  const counts: AttendeeCounts | undefined = countsQuery.data?.counts;
  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const filtering = isFilteringAttendees({ ...filters, search });

  return (
    <div className="space-y-5">
      {days.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label="Event day"
            value={filters.date}
            options={[
              { value: "", label: "All days" },
              ...days.map((item) => ({ value: item.key, label: item.label })),
            ]}
            onChange={(date) => change({ date })}
          />
          <p className="text-sm text-muted">
            Check-ins and counts follow the day you pick.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Registered"
          value={counts?.registered}
          note={
            event.capacity === null
              ? "no seat limit"
              : `of ${formatCount(event.capacity)} seats`
          }
        />
        <Kpi
          label="Checked in"
          value={counts?.checkedIn}
          note={`${day ? day.label : "on any day"} · ${
            counts ? checkedInPercent(counts.checkedIn, counts.registered) : "—"
          } of registered`}
        />
        <Kpi
          label="Pending"
          value={counts?.pending}
          note={
            day
              ? `Registered, not checked in on ${day.label}`
              : "Registered, not checked in yet"
          }
        />
        <Kpi label="Cancelled" value={counts?.cancelled} note="registrations" />
        <Kpi
          label="Session bookings"
          value={event.sessionBookings}
          note={
            counts
              ? `average ${averageBookings(event.sessionBookings, counts.registered)} per attendee`
              : "seats booked across sessions"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox
          label="Search by name, email or ticket code"
          value={filters.search}
          onChange={(value) => change({ search: value })}
        />
        <Select
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => change({ status })}
        />
        <Select
          label="Checked in"
          value={filters.checkedIn}
          options={CHECKED_IN_OPTIONS}
          onChange={(checkedIn) => change({ checkedIn })}
        />
        <Select
          label="Sort"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => change({ sort })}
        />
        {/* In the design, not in route 5 yet: shown switched off and marked Static until the API
            can filter by session and export. */}
        <label htmlFor={sessionSelectId} className="sr-only">
          Session
        </label>
        <select
          id={sessionSelectId}
          disabled
          className={`${SELECT_CLASS} disabled:text-muted`}
        >
          <option>All sessions</option>
        </select>
        <Button variant="secondary" disabled>
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </Button>
        <SourceBadge source="static" />
        <RefreshButton
          eventId={event.id}
          updatedAt={list.dataUpdatedAt}
          timezone={event.timezone}
          failed={list.isError && list.data !== undefined}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {list.isPending ? (
          <ListSkeleton label="Loading attendees" />
        ) : list.isError && list.data === undefined ? (
          // Nothing to show. (A failed REFRESH keeps its rows: the Refresh line says so.)
          <ListError
            title="We couldn't load the registrations"
            error={list.error}
            forbidden="This account cannot see this event's registrations."
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">
              {filtering
                ? "No attendee matches these filters."
                : "Nobody has registered yet."}
            </p>
            {filtering && (
              <Button
                variant="secondary"
                onClick={() =>
                  change({
                    search: "",
                    status: "all",
                    checkedIn: "all",
                  })
                }
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
                      Ticket code
                    </th>
                    <th scope="col" className={TH}>
                      Registered on
                    </th>
                    <th scope="col" className={TH}>
                      Status
                    </th>
                    <th scope="col" className={TH}>
                      {day ? `Checked in on ${day.label}` : "Checked in"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((attendee) => {
                    const name = `${attendee.firstName} ${attendee.lastName}`;
                    const status = attendeeStatus(attendee);
                    return (
                      <tr
                        key={attendee.registrationId}
                        className="border-t border-line align-middle"
                      >
                        <td className="min-w-56 px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name} />
                            <div>
                              <p className="font-semibold">{name}</p>
                              <p className="text-muted">{attendee.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold tracking-wider">
                            {attendee.ticketCode}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatZonedDateTime(
                            attendee.registeredAt,
                            event.timezone,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={status.tone}>
                            <span
                              aria-hidden="true"
                              className="size-1.5 rounded-full bg-current"
                            />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="min-w-44 px-4 py-3">
                          <CheckedInCell
                            attendee={attendee}
                            timezone={event.timezone}
                          />
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
              total={total}
              itemCount={rows.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
