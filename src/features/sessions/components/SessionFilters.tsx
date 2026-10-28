import { Search } from "lucide-react";
import { SESSION_FORMAT_LABELS, SESSION_FORMATS } from "../constants";
import type {
  SessionFilters as Filters,
  SessionSort,
} from "../utils/session-display";

const selectClass =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm";

/**
 * Search box plus the event, format and sort selects. Controlled: the page owns the values. The
 * status is picked with the tabs above, so there is no status select.
 */
export function SessionFilters({
  filters,
  events,
  onChange,
}: {
  filters: Filters;
  /** Event names to offer in the Event select. */
  events: readonly string[];
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
          aria-label="Search sessions"
          placeholder="Search by title or track"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
        />
      </div>
      <select
        aria-label="Event"
        value={filters.event}
        onChange={(event) => onChange({ event: event.target.value })}
        className={selectClass}
      >
        <option value="all">All events</option>
        {events.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Format"
        value={filters.format}
        onChange={(event) => onChange({ format: event.target.value })}
        className={selectClass}
      >
        <option value="all">All formats</option>
        {SESSION_FORMATS.map((format) => (
          <option key={format} value={format}>
            {SESSION_FORMAT_LABELS[format]}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort"
        value={filters.sort}
        onChange={(event) =>
          onChange({ sort: event.target.value as SessionSort })
        }
        className={selectClass}
      >
        <option value="date">Sort: Date (soonest)</option>
        <option value="registrations">Sort: Registrations</option>
      </select>
    </div>
  );
}
