import { Search } from "lucide-react";
import type { OrganizerSort } from "../schemas/organizer.schemas";
import type { OrganizerTabKey } from "../types/admin-organizers";
import { SORT_OPTIONS } from "../utils/organizer-display";

export type EmailFilter = "any" | "verified" | "unverified";

const selectClass =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm";

/**
 * Search box, the email-status select and the sort select. Controlled: the page owns the values.
 * What it shows follows the selected tab: only the waiting list can be filtered by email status
 * (the others are all verified or rejected already), and each list names its sort after its date.
 */
export function OrganizerFilters({
  tab,
  search,
  onSearchChange,
  emailFilter,
  onEmailFilterChange,
  sort,
  onSortChange,
}: {
  tab: OrganizerTabKey;
  search: string;
  onSearchChange: (value: string) => void;
  emailFilter: EmailFilter;
  onEmailFilterChange: (value: EmailFilter) => void;
  sort: OrganizerSort;
  onSortChange: (value: OrganizerSort) => void;
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
          aria-label="Search organizers"
          placeholder="Search by organisation, applicant or email"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
        />
      </div>
      {tab === "pending" && (
        <select
          aria-label="Email status"
          value={emailFilter}
          onChange={(event) =>
            onEmailFilterChange(event.target.value as EmailFilter)
          }
          className={selectClass}
        >
          <option value="any">Any email status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Not verified</option>
        </select>
      )}
      <select
        aria-label="Sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as OrganizerSort)}
        className={selectClass}
      >
        {SORT_OPTIONS[tab].map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
