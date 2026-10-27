import { Search } from "lucide-react";
import type { AccountStatus, UserRole } from "../../types/admin-users";
import type { UserSort } from "../../utils/user-display";

export type RoleFilter = "any" | UserRole;
export type StatusFilter = "any" | AccountStatus;

const selectClass =
  "rounded-md border border-field bg-surface px-3 py-2 text-sm";

/** Search box plus the role, status and sort selects. Controlled: the page owns the values. */
export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  role: RoleFilter;
  onRoleChange: (value: RoleFilter) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  sort: UserSort;
  onSortChange: (value: UserSort) => void;
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
          aria-label="Search users"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-md border border-field bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted/70"
        />
      </div>
      <select
        aria-label="Role"
        value={role}
        onChange={(event) => onRoleChange(event.target.value as RoleFilter)}
        className={selectClass}
      >
        <option value="any">Any role</option>
        <option value="user">Attendee</option>
        <option value="speaker">Speaker</option>
        <option value="organizer">Organizer</option>
        <option value="admin">Administrator</option>
      </select>
      <select
        aria-label="Status"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
        className={selectClass}
      >
        <option value="any">Any status</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="pending">Pending</option>
      </select>
      <select
        aria-label="Sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as UserSort)}
        className={selectClass}
      >
        <option value="newest">Sort: Newest first</option>
        <option value="name">Sort: Name A–Z</option>
        <option value="seen">Sort: Last active</option>
      </select>
    </div>
  );
}
