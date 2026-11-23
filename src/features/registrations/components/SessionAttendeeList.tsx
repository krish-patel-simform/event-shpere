"use client";

import { useState } from "react";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import {
  Avatar,
  Badge,
  Button,
  Kpi,
  SearchBox,
  TablePagination,
} from "@/src/core/ui";
import { useGetSessionAttendeeCounts } from "../hooks/useGetSessionAttendeeCounts";
import { useGetSessionAttendees } from "../hooks/useGetSessionAttendees";
import { SessionCheckInDoor, type SessionDoorSession } from "./CheckInDoors";
import type { attendeeSorts } from "../schemas/attendees.schemas";
import {
  checkedInPercent,
  isFilteringAttendees,
  sessionSeatStatus,
  type AttendeeRowFilters,
} from "../utils/attendee-display";
import {
  CHECKED_IN_OPTIONS,
  FilterSelect,
  LIST_PAGE_SIZE,
  LIST_SEARCH_DELAY_MS,
  ListError,
  ListSkeleton,
  RefreshButton,
  sortOptions,
  STATUS_OPTIONS,
  TH,
} from "./attendee-list-parts";

const SORT_OPTIONS = sortOptions("Booked");

/** What the list needs to know about the session. */
export type AttendeeListSession = {
  eventId: string;
  sessionId: string;
  /** The event's zone: times are shown as the organizer set them. */
  timezone: string;
  /**
   * Seats in the hall; null = no seat limit (online, or no hall yet); undefined = not known yet
   * (the venue's halls are still loading).
   */
  hallCapacity: number | null | undefined;
  /** What the session's check-in door needs: its status, time, event status and place. */
  door: SessionDoorSession;
  /** The event's Check-in tab (the event door), for "check them in there first". */
  eventDoorHref: string;
};

type Filters = AttendeeRowFilters & { sort: (typeof attendeeSorts)[number] };

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "all",
  checkedIn: "all",
  sort: "newest",
};

/**
 * Who holds a seat in one session (route 10), for the event's organizer or an admin: seat counts,
 * then a table searched, filtered, sorted and paged by the server. A seat is checked in at most
 * once (a session happens once), so this one list is both "who booked" and "who came". The
 * counts are read on their own and do not reload when a filter changes.
 */
export function SessionAttendeeList({
  session,
}: {
  session: AttendeeListSession;
}) {
  const { eventId, sessionId, timezone } = session;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search.trim(), LIST_SEARCH_DELAY_MS);

  const list = useGetSessionAttendees(eventId, sessionId, {
    page,
    pageSize: LIST_PAGE_SIZE,
    status: filters.status,
    checkedIn: filters.checkedIn,
    sort: filters.sort,
    search,
  });
  const summary = useGetSessionAttendeeCounts(eventId, sessionId).data;
  const counts = summary?.counts;

  // Every change starts again from the first page.
  function change(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const filtering = isFilteringAttendees({ ...filters, search });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Seats booked"
          value={counts?.registered}
          note={
            session.hallCapacity === undefined
              ? "seats in this session"
              : session.hallCapacity === null
                ? "no seat limit"
                : `of ${session.hallCapacity} seats`
          }
        />
        <Kpi
          label="Checked in"
          value={counts?.checkedIn}
          note={`at this session · ${
            counts ? checkedInPercent(counts.checkedIn, counts.registered) : "—"
          }`}
        />
        <Kpi
          label="Pending"
          value={counts?.pending}
          note="Booked, not checked in yet"
        />
        <Kpi label="Cancelled" value={counts?.cancelled} note="seats" />
      </div>

      <SessionCheckInDoor
        eventId={eventId}
        sessionId={sessionId}
        session={session.door}
        timezone={timezone}
        opensHoursBefore={summary?.checkInOpensHoursBefore ?? null}
        eventDoorHref={session.eventDoorHref}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox
          label="Search by name, email or ticket code"
          value={filters.search}
          onChange={(value) => change({ search: value })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => change({ status })}
        />
        <FilterSelect
          label="Checked in"
          value={filters.checkedIn}
          options={CHECKED_IN_OPTIONS}
          onChange={(checkedIn) => change({ checkedIn })}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => change({ sort })}
        />
        <RefreshButton
          eventId={eventId}
          updatedAt={list.dataUpdatedAt}
          timezone={timezone}
          failed={list.isError && list.data !== undefined}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {list.isPending ? (
          <ListSkeleton label="Loading session attendees" />
        ) : list.isError && list.data === undefined ? (
          // Nothing to show. (A failed REFRESH keeps its rows: the Refresh line says so.)
          <ListError
            title="We couldn't load who booked this session"
            error={list.error}
            forbidden="This account cannot see this session's attendees."
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <div className="space-y-3 px-5 py-10 text-center">
            <p className="text-muted">
              {filtering
                ? "No seat matches these filters."
                : "Nobody has booked a seat yet."}
            </p>
            {filtering && (
              <Button
                variant="secondary"
                onClick={() =>
                  change({ search: "", status: "all", checkedIn: "all" })
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
                  People holding a seat in this session
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
                      Booked on
                    </th>
                    <th scope="col" className={TH}>
                      Seat
                    </th>
                    <th scope="col" className={TH}>
                      Checked in
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((seat) => {
                    const name = `${seat.firstName} ${seat.lastName}`;
                    const status = sessionSeatStatus(seat);
                    return (
                      <tr
                        key={seat.bookingId}
                        className="border-t border-line align-middle"
                      >
                        <td className="min-w-56 px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name} />
                            <div>
                              <p className="font-semibold">{name}</p>
                              <p className="text-muted">{seat.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {/* The person's EVENT ticket: the session door types it in. */}
                          <span className="font-mono font-semibold tracking-wider">
                            {seat.ticketCode}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatZonedDateTime(seat.bookedAt, timezone)}
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
                        <td className="min-w-44 whitespace-nowrap px-4 py-3">
                          {seat.checkedInAt ? (
                            formatZonedDateTime(seat.checkedInAt, timezone)
                          ) : (
                            <span className="text-muted">
                              {seat.status === "cancelled"
                                ? "Not applicable"
                                : "Not checked in"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={LIST_PAGE_SIZE}
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
