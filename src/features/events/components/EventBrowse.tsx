"use client";

import { CalendarX, Search, SearchX, X } from "lucide-react";
import { useId, useState } from "react";
import { formatCount } from "@/src/core/format/format-number";
import { Alert, Button, SourceBadge, TablePagination } from "@/src/core/ui";
import { useGetPublicEventList } from "../hooks/useGetPublicEventList";
import type {
  PublicEventSort,
  PublicEventWhen,
} from "../schemas/event-public.schemas";
import { PublicEventCard } from "./PublicEventCard";
import { PublicEventFilters, type PriceFilter } from "./PublicEventFilters";

const PAGE_SIZE = 12;

const SORT_OPTIONS: readonly { value: PublicEventSort; label: string }[] = [
  { value: "soonest", label: "Date: soonest first" },
  { value: "latest", label: "Date: latest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "popular", label: "Most popular" },
];

/**
 * The events everyone can browse (GET /api/events): published events as cards, searched by title,
 * filtered by date and price, sorted and paged by the server. Guests can use it too. The
 * Live / Static badges say which controls the API backs today.
 */
export function EventBrowse() {
  const searchId = useId();

  // What is typed in the box, and what was last searched for (the one the list is loaded with).
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [when, setWhen] = useState<PublicEventWhen>("upcoming");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<PublicEventSort>("soonest");
  const [page, setPage] = useState(1);

  const events = useGetPublicEventList({
    search: term,
    // "all" is not a value the API knows: it is the same as leaving the filter out.
    price: price === "all" ? undefined : price,
    when,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  // Any change to what is asked for starts again from the first page.
  function changeWhen(next: PublicEventWhen) {
    setWhen(next);
    setPage(1);
  }
  function changePrice(next: PriceFilter) {
    setPrice(next);
    setPage(1);
  }
  function changeSort(next: PublicEventSort) {
    setSort(next);
    setPage(1);
  }

  const isFiltered = term !== "" || when !== "upcoming" || price !== "all";
  const clearAll = () => {
    setSearch("");
    setTerm("");
    setWhen("upcoming");
    setPrice("all");
    setPage(1);
  };

  const items = events.data?.items ?? [];
  const total = events.data?.meta.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Discover events</h1>
        <p className="text-muted">
          Conferences, workshops and meetups. Browse freely; log in to register.
        </p>
      </header>

      {/* Searches when the visitor presses Search or Enter, not on every key. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
          setPage(1);
        }}
        className="rounded-lg border border-line bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={searchId} className="text-sm font-semibold">
            Find an event
          </label>
          <SourceBadge source="live" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              placeholder="Search by event name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md border border-field bg-surface py-2.5 pl-11 pr-3 placeholder:text-muted/70"
            />
          </div>
          <Button type="submit" className="px-6">
            Search
          </Button>
          {(term !== "" || search !== "") && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setTerm("");
                setPage(1);
              }}
            >
              <X aria-hidden="true" className="size-4" />
              Clear
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          Searches the event name. Press Enter or Search.
        </p>
      </form>

      <div className="flex flex-wrap items-start gap-6">
        <div className="w-full shrink-0 lg:w-60">
          <PublicEventFilters
            when={when}
            price={price}
            onWhenChange={changeWhen}
            onPriceChange={changePrice}
            onClear={clearAll}
            canClear={isFiltered}
          />
        </div>

        <section
          aria-label="Events"
          className="flex min-w-0 flex-1 basis-96 flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {events.isSuccess
                ? term
                  ? `${formatCount(total)} ${total === 1 ? "event matches" : "events match"} “${term}”`
                  : `${formatCount(total)} ${total === 1 ? "event" : "events"}`
                : "Events"}
              <SourceBadge source="live" />
            </h2>
            <div className="flex items-center gap-2">
              <select
                aria-label="Sort events"
                value={sort}
                onChange={(event) =>
                  changeSort(event.target.value as PublicEventSort)
                }
                className="rounded-md border border-field bg-surface px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {events.isPending ? (
            <div
              role="status"
              aria-label="Loading events"
              className="grid animate-pulse grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-5 motion-reduce:animate-none"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-line bg-surface"
                >
                  <div className="h-33 bg-surface-subtle" />
                  <div className="space-y-2 p-4">
                    <div className="h-5 w-48 rounded bg-surface-subtle" />
                    <div className="h-4 w-36 rounded bg-surface-subtle" />
                    <div className="h-4 w-40 rounded bg-surface-subtle" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.isError ? (
            <Alert tone="error" title="We couldn't load the events">
              {events.error.message}
              <Button
                variant="secondary"
                onClick={() => void events.refetch()}
                className="mt-3"
              >
                Try again
              </Button>
            </Alert>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-5 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-surface-subtle text-muted">
                {isFiltered ? (
                  <SearchX aria-hidden="true" className="size-6" />
                ) : (
                  <CalendarX aria-hidden="true" className="size-6" />
                )}
              </span>
              <p className="text-base font-semibold">
                {isFiltered ? "No events match." : "No events yet."}
              </p>
              <p className="max-w-sm text-sm text-muted">
                {isFiltered
                  ? "Try a shorter name, or change the date and price filters."
                  : "Events show up here once an organizer publishes them."}
              </p>
              {isFiltered && (
                <Button variant="secondary" onClick={clearAll} className="mt-2">
                  Clear search and filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-5">
                {items.map((event) => (
                  <PublicEventCard key={event.slug} event={event} />
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
        </section>
      </div>
    </div>
  );
}
