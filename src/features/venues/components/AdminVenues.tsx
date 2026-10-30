"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { buttonStyles, TablePagination, Tabs } from "@/src/core/ui";
import { useGetVenueList } from "../hooks/useGetVenueList";
import { VENUE_ROUTES } from "../routes";
import type { VenueSort } from "../schemas/venue.schemas";
import {
  tabStatus,
  TAB_DESCRIPTIONS,
  VENUE_TABS,
  type VenueRef,
  type VenueTabKey,
} from "../utils/venue-display";
import { ActivateVenueDialog } from "./ActivateVenueDialog";
import { AddHallDialog } from "./AddHallDialog";
import { DeactivateVenueDialog } from "./DeactivateVenueDialog";
import { VenueFilters } from "./VenueFilters";
import { VenueListPanel } from "./VenueListPanel";
import { VenuesTable } from "./VenuesTable";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const PANEL_ID = "venues-panel";

/** The dialog the admin opened from a row's menu: one is open at a time. */
type RowDialog = {
  kind: "add-hall" | "deactivate" | "activate";
  venue: VenueRef;
};

/**
 * The admin's Venues page: one tab per list (all, active, inactive), a search box and a sort.
 * Search, sort and paging are all done by the server (GET /api/venues). Only the selected tab is
 * requested. A row opens the venue's page, and its menu adds a hall or activates/deactivates the
 * venue without leaving the list.
 */
export function AdminVenues() {
  const [tab, setTab] = useState<VenueTabKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<VenueSort>("name");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<RowDialog | null>(null);

  // The box updates at once; the API is asked once the admin stops typing.
  const term = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  const list = useGetVenueList({
    status: tabStatus(tab),
    search: term,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setDialog(null), []);

  // A new tab, search or sort starts again from the first page.
  const changed = <T,>(set: (value: T) => void) => {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  };

  const isFiltered = term !== "";
  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  // A failed load shows an error only when there is nothing to show; otherwise the rows we have
  // stay on screen.
  const error =
    list.isError && !list.data ? (list.error?.message ?? "Try again.") : null;
  const close = () => setDialog(null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Venues</h1>
          <p className="max-w-xl text-muted">
            The places where events are held, and the halls inside each one.
            Organizers pick a venue and a hall when they place a session on the
            schedule.
          </p>
        </div>
        <Link
          href={VENUE_ROUTES.new}
          className={buttonStyles({ variant: "primary" })}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add venue
        </Link>
      </header>

      <Tabs
        label="Filter venues"
        tabs={VENUE_TABS}
        value={tab}
        onChange={changed(setTab)}
        panelId={PANEL_ID}
      />

      <VenueFilters
        search={search}
        onSearchChange={changed(setSearch)}
        sort={sort}
        onSortChange={changed(setSort)}
      />

      <VenueListPanel
        panelId={PANEL_ID}
        tab={tab}
        description={TAB_DESCRIPTIONS[tab]}
        summary={
          list.data
            ? `${formatCount(total)} ${isFiltered ? "matching" : "in total"}`
            : undefined
        }
        isLoading={list.isPending}
        error={error}
        onRetry={() => void list.refetch()}
      >
        <VenuesTable
          venues={rows}
          isFiltered={isFiltered}
          onAddHall={(venue) => setDialog({ kind: "add-hall", venue })}
          onDeactivate={(venue) => setDialog({ kind: "deactivate", venue })}
          onActivate={(venue) => setDialog({ kind: "activate", venue })}
        />
        {rows.length > 0 && (
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            itemCount={rows.length}
            onPageChange={setPage}
          />
        )}
      </VenueListPanel>

      <AddHallDialog
        venue={dialog?.kind === "add-hall" ? dialog.venue : null}
        onClose={close}
      />
      <DeactivateVenueDialog
        venue={dialog?.kind === "deactivate" ? dialog.venue : null}
        onClose={close}
      />
      <ActivateVenueDialog
        venue={dialog?.kind === "activate" ? dialog.venue : null}
        onClose={close}
      />
    </div>
  );
}
