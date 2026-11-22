"use client";

import { Ticket } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import {
  Alert,
  Button,
  buttonStyles,
  TablePagination,
  tabId,
  Tabs,
  type Tab,
} from "@/src/core/ui";
import { useGetMyTickets } from "../hooks/useGetMyTickets";
import { REGISTRATION_ROUTES } from "../routes";
import type { MyTicketDto } from "../schemas/registrations.schemas";
import { CancelTicketDialog } from "./CancelTicketDialog";
import { MyTicketCard } from "./MyTicketCard";
import { TicketDialog } from "./TicketDialog";

type When = "upcoming" | "past" | "all";
type StatusFilter = "all" | "registered" | "cancelled";

const PANEL_ID = "tickets-panel";
const PAGE_SIZE = 10;

// "upcoming" is every event that has not ENDED (route 4 filters by the event's end): an event
// running right now is in it, at the top, so the tab says "Current & upcoming".
const WHEN_TABS: readonly Tab<When>[] = [
  { key: "upcoming", label: "Current & upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "registered", label: "Registered" },
  { value: "cancelled", label: "Cancelled" },
];

/** The empty state's title, by tab and status. */
function emptyTitle(when: When, status: StatusFilter): string {
  const kind =
    status === "registered"
      ? "registered "
      : status === "cancelled"
        ? "cancelled "
        : "";
  if (when === "upcoming") return `No current or upcoming ${kind}tickets`;
  if (when === "past") return `No past ${kind}tickets`;
  return `No ${kind}tickets yet`;
}

/**
 * "My tickets" (route 4): every event the signed-in attendee registered for, by Current &
 * upcoming / Past / All (when the EVENT ends) and by status. Each row shows the ticket code, the booked sessions
 * and what can be done: show the ticket, open the event, cancel, register again. Only the
 * selected query is requested, and while a new one loads the list shows the skeleton, never the
 * rows of the previous one.
 */
export function MyTickets() {
  const [when, setWhen] = useState<When>("upcoming");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const list = useGetMyTickets({ when, status, page, pageSize: PAGE_SIZE });

  // The ticket whose dialog is open; null = closed.
  const [showing, setShowing] = useState<MyTicketDto | null>(null);
  const [cancelling, setCancelling] = useState<MyTicketDto | null>(null);
  const [cancelled, setCancelled] = useState<MyTicketDto | null>(null);
  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the attendee comes back. Close them as the page is hidden.
  useLayoutEffect(
    () => () => {
      setShowing(null);
      setCancelling(null);
    },
    [],
  );

  function changeWhen(next: When) {
    setWhen(next);
    setPage(1);
  }
  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  const tickets = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My tickets</h1>
          <p className="max-w-xl text-muted">
            Your event registrations. Show your ticket code at the entrance to
            check in.
          </p>
        </div>
        <Link
          href={REGISTRATION_ROUTES.browseEvents}
          className={buttonStyles({ variant: "secondary" })}
        >
          Browse events
        </Link>
      </header>

      {cancelled && (
        <Alert
          tone="success"
          title={`Your registration for ${cancelled.event.title} was cancelled`}
        >
          Your session seats were released and the ticket code no longer works.
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          label="Filter tickets by when the event is"
          tabs={WHEN_TABS}
          // The API counts only the selected filter, so only its tab shows a number.
          counts={list.data ? { [when]: total } : {}}
          value={when}
          onChange={changeWhen}
          panelId={PANEL_ID}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as StatusFilter)}
            className="rounded-md border border-field bg-surface px-3 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(PANEL_ID, when)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        {list.isPending ? (
          <div
            role="status"
            aria-label="Loading tickets"
            className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-20 rounded bg-surface-subtle" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="p-5">
            <Alert tone="error" title="We couldn't load your tickets">
              {list.error.message}
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void list.refetch()}
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Ticket aria-hidden="true" className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">
              {emptyTitle(when, status)}
            </h2>
            <p className="max-w-xs text-muted">
              When you register for an event, your ticket shows up here.
            </p>
            {status !== "all" ? (
              <Button variant="secondary" onClick={() => changeStatus("all")}>
                Show all statuses
              </Button>
            ) : (
              <Link
                href={REGISTRATION_ROUTES.browseEvents}
                className={buttonStyles({ variant: "primary" })}
              >
                Browse events
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul aria-label="Tickets">
              {tickets.map((ticket) => (
                <MyTicketCard
                  key={ticket.registration.id}
                  ticket={ticket}
                  now={now}
                  onShowTicket={setShowing}
                  onCancel={(row) => {
                    setCancelled(null);
                    setCancelling(row);
                  }}
                />
              ))}
            </ul>
            {total > PAGE_SIZE && (
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                itemCount={tickets.length}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      <p className="text-sm text-muted">
        An event that is running now stays at the top of Current & upcoming
        until its last day ends, then moves to Past. Current & upcoming is
        soonest first; Past and All show the most recent first.
      </p>

      {showing && (
        <TicketDialog
          open
          onClose={() => setShowing(null)}
          eventTitle={showing.event.title}
          ticketCode={showing.registration.ticketCode}
        />
      )}
      {cancelling && (
        <CancelTicketDialog
          ticket={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={(row) => {
            setCancelling(null);
            setCancelled(row);
          }}
        />
      )}
    </div>
  );
}
