"use client";

import { Building2, Search, SearchX, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { Alert, Button, buttonStyles, TablePagination } from "@/src/core/ui";
import { useHasPermission } from "@/src/features/auth";
import { useGetVenueList } from "../hooks/useGetVenueList";
import { VENUE_ROUTES } from "../routes";
import type { VenueSort } from "../schemas/venue.schemas";
import { SORT_OPTIONS } from "../utils/venue-display";
import { VenueCard } from "./VenueCard";

const PAGE_SIZE = 12;
const SEARCH_DELAY_MS = 300;

/**
 * Discover: the venues everyone can browse (GET /api/venues). Always asks for active venues
 * only, so an admin sees the same list as a guest; searched by name or city, sorted and paged by
 * the server. Anyone allowed to manage venues (VENUE_MANAGE) also sees a link to the admin page.
 */
export function VenueDirectory() {
  const canManage = useHasPermission("VENUE_MANAGE");
  const searchId = useId();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<VenueSort>("name");
  const [page, setPage] = useState(1);

  // The box updates at once; the API is asked once the visitor stops typing.
  const term = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  // Always fresh: a venue deactivated in the meantime (by an admin elsewhere) is never shown
  // from an old cached copy.
  const venues = useGetVenueList(
    { status: "active", search: term, sort, page, pageSize: PAGE_SIZE },
    { alwaysFresh: true },
  );

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const items = venues.data?.items ?? [];
  const total = venues.data?.meta.total ?? 0;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Venues</h1>
          <p className="text-muted">
            Find a place where events are held and see its halls.
          </p>
        </div>
        {canManage && (
          <Link
            href={VENUE_ROUTES.list}
            className={buttonStyles({ variant: "secondary" })}
          >
            <Settings2 aria-hidden="true" className="size-4" />
            Manage venues
          </Link>
        )}
      </header>

      {/* Searches as the visitor types (after a short pause); Enter does nothing extra. */}
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="rounded-lg border border-line bg-surface p-4 sm:p-5"
      >
        <label htmlFor={searchId} className="text-sm font-semibold">
          Find a venue
        </label>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              aria-label="Search venues"
              placeholder="Search by venue name or city"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                // A new search starts again from the first page.
                setPage(1);
              }}
              className="w-full rounded-md border border-field bg-surface py-2.5 pl-11 pr-3 placeholder:text-muted/70"
            />
          </div>
          {search !== "" && (
            <Button variant="secondary" onClick={clearSearch}>
              <X aria-hidden="true" className="size-4" />
              Clear
            </Button>
          )}
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as VenueSort);
              setPage(1);
            }}
            className="rounded-md border border-field bg-surface px-3 py-2.5 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-sm text-muted">
          Searches venue names and cities as you type.
        </p>
      </form>

      {/* Until this visit's own request answers: never rows from before (see ALWAYS_FRESH). */}
      {venues.isPending || !venues.isFetchedAfterMount ? (
        <div
          role="status"
          aria-label="Loading venues"
          className="grid animate-pulse grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5 motion-reduce:animate-none"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-line bg-surface p-5"
            >
              <div className="flex gap-3">
                <div className="size-11 rounded-md bg-surface-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-surface-subtle" />
                  <div className="h-4 w-1/2 rounded bg-surface-subtle" />
                </div>
              </div>
              <div className="h-4 w-5/6 rounded bg-surface-subtle" />
              <div className="h-4 w-1/3 rounded bg-surface-subtle" />
            </div>
          ))}
        </div>
      ) : venues.isError ? (
        <Alert tone="error" title="We couldn't load the venues">
          {venues.error.message}
          <Button
            variant="secondary"
            onClick={() => void venues.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface-subtle text-muted">
            {term ? (
              <SearchX aria-hidden="true" className="size-6" />
            ) : (
              <Building2 aria-hidden="true" className="size-6" />
            )}
          </span>
          <p className="text-base font-semibold">
            {term ? "No venues match your search." : "No venues yet."}
          </p>
          <p className="max-w-sm text-sm text-muted">
            {term
              ? `No venue name or city has “${term}” in it. Check the spelling or try a shorter word.`
              : "Venues show up here once they are added."}
          </p>
          {term && (
            <Button variant="secondary" onClick={clearSearch} className="mt-2">
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {term
                ? `${formatCount(total)} ${total === 1 ? "venue matches" : "venues match"} “${term}”`
                : `${formatCount(total)} ${total === 1 ? "venue" : "venues"}`}
            </h2>
            <p className="text-sm text-muted">Sorted by {sortLabel}</p>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5">
            {items.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </ul>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              itemCount={items.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
