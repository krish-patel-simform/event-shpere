import { Search } from "lucide-react";
import type { EventSort } from "../schemas/event-manage.schemas";
import type { EventFilters as Filters } from "../utils/event-display";

const selectClass =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm";

/**
 * Search box plus the sort select. Controlled: the page owns the values. The status is picked
 * with the tabs above, so there is no status select.
 */
export function EventFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
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
          aria-label="Search events by title"
          placeholder="Search events by title"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
        />
      </div>
      <select
        aria-label="Sort"
        value={filters.sort}
        onChange={(event) =>
          onChange({ sort: event.target.value as EventSort })
        }
        className={selectClass}
      >
        <option value="soonest">Date: soonest first</option>
        <option value="latest">Date: latest first</option>
      </select>
    </div>
  );
}
