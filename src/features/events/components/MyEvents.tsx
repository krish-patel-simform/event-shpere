"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { Alert, Button, buttonStyles, tabId, Tabs } from "@/src/core/ui";
import { useCancelEvent } from "../hooks/useCancelEvent";
import { useGetMyEventCounts } from "../hooks/useGetMyEventCounts";
import { useGetMyEventList } from "../hooks/useGetMyEventList";
import { EVENT_ROUTES } from "../routes";
import type { EventTabKey } from "../schemas/event-manage.schemas";
import type { ManagedEvent } from "../types/event-manage.types";
import {
  DEFAULT_EVENT_FILTERS,
  EVENT_TABS,
  isFiltering,
  TAB_DESCRIPTIONS,
  type EventFilters as Filters,
} from "../utils/event-display";
import { CancelEventDialog } from "./EventDialogs";
import { EventFilters } from "./EventFilters";
import { EventsTable } from "./EventsTable";

const PANEL_ID = "events-panel";
const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

/**
 * The organizer's "My events" page: their events by status tab, with a search and a sort. The
 * tab, the search, the sort and the page are all asked of the server (GET /api/me/events); the
 * numbers on the tabs come from GET /api/me/events/counts and do not change with the search.
 * Only the selected query is requested, and while a new one loads the page shows the skeleton,
 * never the rows of the previous one.
 */
export function MyEvents() {
  const [tab, setTab] = useState<EventTabKey>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_EVENT_FILTERS);
  const [page, setPage] = useState(1);

  // The box updates at once; the API is asked once the organizer stops typing.
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
  // would still be open when the organizer comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setCancelling(null), []);

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

      <Tabs
        label="Filter events by status"
        tabs={EVENT_TABS}
        counts={counts.data}
        value={tab}
        onChange={changeTab}
        panelId={PANEL_ID}
      />

      <EventFilters filters={filters} onChange={changeFilters} />

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(PANEL_ID, tab)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        <p className="sr-only">{TAB_DESCRIPTIONS[tab]}</p>
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
            <Alert tone="error" title="We couldn't load your events">
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
            events={events}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isFiltered={isFiltering(tab, { ...filters, search: term })}
            onClearFilters={clearFilters}
            onCancel={askToCancel}
          />
        )}
      </div>

      <CancelEventDialog
        event={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
