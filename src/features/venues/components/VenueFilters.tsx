import { Search } from "lucide-react";
import type { VenueSort } from "../schemas/venue.schemas";
import { SORT_OPTIONS } from "../utils/venue-display";

/** The search box and the sort select. Controlled: the page owns the values. */
export function VenueFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sort: VenueSort;
  onSortChange: (value: VenueSort) => void;
}) {
  return (
    <div role="search" className="flex flex-wrap gap-2.5">
      <div className="relative min-w-60 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          aria-label="Search venues"
          placeholder="Search by venue name or city"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
        />
      </div>
      <select
        aria-label="Sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as VenueSort)}
        className="rounded-md border border-field bg-surface px-3 py-2 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
