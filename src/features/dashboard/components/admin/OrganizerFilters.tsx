import { Search } from "lucide-react";
import { cn } from "@/src/core/ui";

export type EmailFilter = "any" | "verified" | "unverified";
export type OrganizerSort = "oldest" | "newest";

const selectClass =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm";

/**
 * Search box plus the email-status and sort selects. Controlled: the page owns the values and
 * decides which lists they apply to.
 */
export function OrganizerFilters({
  search,
  onSearchChange,
  emailFilter,
  onEmailFilterChange,
  sort,
  onSortChange,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  emailFilter: EmailFilter;
  onEmailFilterChange: (value: EmailFilter) => void;
  sort: OrganizerSort;
  onSortChange: (value: OrganizerSort) => void;
  className?: string;
}) {
  return (
    <div role="search" className={cn("flex flex-wrap gap-2.5", className)}>
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
      <select
        aria-label="Sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as OrganizerSort)}
        className={selectClass}
      >
        <option value="oldest">Sort: Oldest first</option>
        <option value="newest">Sort: Newest first</option>
      </select>
    </div>
  );
}
