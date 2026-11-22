"use client";

import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { useId, useLayoutEffect, useState } from "react";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import {
  Alert,
  Button,
  buttonStyles,
  Kpi,
  SourceBadge,
  tabId,
  Tabs,
} from "@/src/core/ui";
import { useCancelEvent } from "../hooks/useCancelEvent";
import { useDeleteEvent } from "../hooks/useDeleteEvent";
import { useGetMyEventCounts } from "../hooks/useGetMyEventCounts";
import { useGetMyEventList } from "../hooks/useGetMyEventList";
import { EVENT_ROUTES } from "../routes";
import type {
  EventTabCounts,
  EventTabKey,
} from "../schemas/event-manage.schemas";
import type { ManagedEvent } from "../types/event-manage.types";
import {
  ADMIN_TAB_DESCRIPTIONS,
  DEFAULT_EVENT_FILTERS,
  EVENT_TABS,
  isFiltering,
  TAB_DESCRIPTIONS,
  type EventFilters as Filters,
} from "../utils/event-display";
import { CancelEventDialog, DeleteDraftDialog } from "./EventDialogs";
import { EventFilters } from "./EventFilters";
import { EventsTable, type EventListVariant } from "./EventsTable";

const PANEL_ID = "events-panel";
const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const STATIC_SELECT_CLASS =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm disabled:text-muted";

/**
 * The organizer's "My events" page: their events by status tab, with a search and a sort.
 */
export function MyEvents() {
  return <EventList variant="organizer" />;
}

/**
 * The admin's "Manage events" page: every organizer's events, with the same tabs, search, sort
 * and row actions, plus count cards, an Organizer column and shortcuts to each event's
 * registrations, sessions and organizer. The same API answers both (GET /api/me/events and
 * /counts return every event for EVENT_MANAGE_ALL).
 */
export function ManageEvents() {
  return <EventList variant="admin" />;
}

/**
 * One list of events. The tab, the search, the sort and the page are all asked of the server
 * (GET /api/me/events); the numbers on the tabs (and the admin's count cards) come from
 * GET /api/me/events/counts and do not change with the search. Only the selected query is
 * requested, and while a new one loads the page shows the skeleton, never the rows of the
 * previous one.
 */
function EventList({ variant }: { variant: EventListVariant }) {
  const isAdmin = variant === "admin";
  const [tab, setTab] = useState<EventTabKey>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_EVENT_FILTERS);
  const [page, setPage] = useState(1);

  // The box updates at once; the API is asked once the user stops typing.
  const term = useDebouncedValue(filters.search.trim(), SEARCH_DELAY_MS);

  const list = useGetMyEventList({
    status: tab,
    search: term,
    sort: filters.sort,
    page,
    pageSize: PAGE_SIZE,
  });
  const counts = useGetMyEventCounts();

  // The event whose "Cancel event" dialog is open; null = closed.
  const [cancelling, setCancelling] = useState<ManagedEvent | null>(null);
  const cancel = useCancelEvent();

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the user comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setCancelling(null), []);

  // The draft whose "Delete draft" dialog is open; null = closed. Same shape as cancelling.
  const [deleting, setDeleting] = useState<ManagedEvent | null>(null);
  const remove = useDeleteEvent();
  useLayoutEffect(() => () => setDeleting(null), []);

  function askToDelete(event: ManagedEvent) {
    remove.reset();
    setDeleting(event);
  }
  function confirmDelete(event: ManagedEvent) {
    if (remove.isPending) return;
    remove.mutate(event.id, { onSettled: () => setDeleting(null) });
  }

  function askToCancel(event: ManagedEvent) {
    cancel.reset();
    setCancelling(event);
  }
  // The dialog closes when the answer comes, whether it worked or not; the message says which.
  function confirmCancel(event: ManagedEvent) {
    if (cancel.isPending) return;
    cancel.mutate(event.id, { onSettled: () => setCancelling(null) });
  }

  // A new tab, search or sort starts again from the first page.
  function changeTab(next: EventTabKey) {
    setTab(next);
    setPage(1);
  }
  function changeFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }
  function clearFilters() {
    setTab("all");
    setFilters(DEFAULT_EVENT_FILTERS);
    setPage(1);
  }

  const events = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  // A failed load shows an error only when there is nothing to show; otherwise the rows we have
  // stay on screen.
  const error =
    list.isError && !list.data ? (list.error?.message ?? "Try again.") : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {isAdmin ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Manage events</h1>
            <p className="max-w-xl text-muted">
              Every event from every organizer, by status. Open an event to see
              its registrations and sessions.
            </p>
          </div>
          {/* No export API yet: shown, switched off, and marked Static. */}
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled>
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </Button>
            <SourceBadge source="static" />
          </div>
        </header>
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">My events</h1>
            <p className="max-w-xl text-muted">
              The events you organise. Drafts are only visible to you.
            </p>
          </div>
          <Link
            href={EVENT_ROUTES.new}
            className={buttonStyles({ variant: "primary" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Create event
          </Link>
        </header>
      )}

      {isAdmin && (
        <>
          <AdminEventKpis counts={counts.data} />
          <Alert tone="info" title="Only organizers create events">
            Open an event to edit it, manage its sessions or cancel it. What you
            change applies to the organizer&apos;s event.
          </Alert>
        </>
      )}

      {cancel.isSuccess && (
        <Alert tone="success" title={`${cancel.data.title} was cancelled`}>
          Registration is closed, and its page shows a cancelled banner.
        </Alert>
      )}
      {cancel.isError && (
        <Alert tone="error" title="We couldn't cancel the event">
          {cancel.error.message}
        </Alert>
      )}
      {remove.isSuccess && (
        <Alert tone="success" title="The draft was deleted">
          Its sessions, description and images were removed too.
        </Alert>
      )}
      {remove.isError && (
        <Alert tone="error" title="We couldn't delete the draft">
          {remove.error.message}
        </Alert>
      )}

      <Tabs
        label="Filter events by status"
        tabs={EVENT_TABS}
        counts={counts.data}
        value={tab}
        onChange={changeTab}
        panelId={PANEL_ID}
      />

      <EventFilters filters={filters} onChange={changeFilters}>
        {isAdmin && <AdminStaticFilters />}
      </EventFilters>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(PANEL_ID, tab)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        <p className="sr-only">
          {(isAdmin ? ADMIN_TAB_DESCRIPTIONS : TAB_DESCRIPTIONS)[tab]}
        </p>
        {list.isPending ? (
          <div
            role="status"
            aria-label="Loading events"
            className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 rounded bg-surface-subtle" />
            ))}
          </div>
        ) : error ? (
          <div className="p-5">
            <Alert
              tone="error"
              title={
                isAdmin
                  ? "We couldn't load the events"
                  : "We couldn't load your events"
              }
            >
              {error}
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void list.refetch()}
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : (
          <EventsTable
            variant={variant}
            events={events}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isFiltered={isFiltering(tab, { ...filters, search: term })}
            onClearFilters={clearFilters}
            onCancel={askToCancel}
            onDelete={askToDelete}
          />
        )}
      </div>

      <CancelEventDialog
        event={cancelling}
        isPending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
      <DeleteDraftDialog
        event={deleting}
        isPending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/**
 * The admin's count cards, from the same counts as the tabs ("—" while they load or if they
 * failed: the tabs and the list still work). Registrations across every event has no API yet,
 * so that card is marked Static.
 */
function AdminEventKpis({ counts }: { counts: EventTabCounts | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Total events"
        value={counts?.all}
        note="From every organizer"
      />
      <Kpi
        label="Published"
        value={counts?.published}
        note="Open for registration"
      />
      <Kpi label="Completed" value={counts?.completed} note="Already held" />
      <Kpi label="Drafts" value={counts?.draft} note="Not published yet" />
      <Kpi
        label="Cancelled"
        value={counts?.cancelled}
        note="Registration closed"
      />
      <Kpi
        label="Registrations"
        value={undefined}
        note="Across every event"
        badge={<SourceBadge source="static" />}
      />
    </div>
  );
}

/**
 * The design's organizer, format and date filters. GET /api/me/events cannot filter by them
 * yet, so they are shown, switched off and marked Static rather than dropped.
 */
function AdminStaticFilters() {
  const id = useId();
  const selects = [
    { key: "organizer", label: "Organizer", option: "All organizers" },
    { key: "format", label: "Format", option: "Any format" },
    { key: "date", label: "Date", option: "Any date" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {selects.map((select) => (
        <span key={select.key}>
          <label htmlFor={`${id}-${select.key}`} className="sr-only">
            {select.label}
          </label>
          <select
            id={`${id}-${select.key}`}
            disabled
            className={STATIC_SELECT_CLASS}
          >
            <option>{select.option}</option>
          </select>
        </span>
      ))}
      <SourceBadge source="static" />
    </div>
  );
}
