import Link from "next/link";
import {
  ActionMenu,
  Avatar,
  Badge,
  cn,
  type ActionMenuItem,
} from "@/src/core/ui";
import { adminUserHref } from "../../nav-items";
import type { AdminUser } from "../../types/admin-users";
import { formatDate } from "../../utils/format-date";
import {
  formatLastActive,
  roleBadge,
  statusBadge,
  userFullName,
} from "../../utils/user-display";
import { TablePagination } from "./TablePagination";

const TH = "px-4 py-2.5 font-semibold";

type UsersTableProps = {
  users: readonly AdminUser[];
  /** ISO date-time "last active" counts up to. */
  asOf: string;
  /** Users matching the selected tab on the whole platform. */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** A search or filter is active, so an empty list means "no match". */
  isFiltered: boolean;
  menuItems: (user: AdminUser) => ActionMenuItem[];
};

/** The users list: one row per account, with a row menu of actions and paging. */
export function UsersTable({
  users,
  asOf,
  total,
  page,
  pageSize,
  onPageChange,
  isFiltered,
  menuItems,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-muted">
        {isFiltered ? "No users match your search." : "No users yet."}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className={TH}>
                User
              </th>
              <th scope="col" className={TH}>
                Role
              </th>
              <th scope="col" className={TH}>
                Email
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                Joined
              </th>
              <th scope="col" className={TH}>
                Last active
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const name = userFullName(user);
              const role = roleBadge(user);
              const status = statusBadge(user.status);
              return (
                <tr key={user.id} className="border-t border-line align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={name} />
                      <div className="min-w-0">
                        <Link
                          href={adminUserHref(user.id)}
                          className={cn(
                            "font-semibold hover:underline",
                            user.status === "suspended" && "text-muted",
                          )}
                        >
                          {name}
                        </Link>
                        <p className="text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={role.tone}>{role.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.emailVerified ? (
                      <Badge tone="success">Verified</Badge>
                    ) : (
                      <Badge tone="warning">Not verified</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone} className="gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                      />
                      {status.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(user.joinedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {formatLastActive(user.lastActiveAt, asOf)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      label={`Actions for ${name}`}
                      items={menuItems(user)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        itemCount={users.length}
        onPageChange={onPageChange}
      />
    </>
  );
}
