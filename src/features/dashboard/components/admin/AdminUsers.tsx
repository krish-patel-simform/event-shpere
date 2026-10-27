"use client";

import {
  Ban,
  Mail,
  UserCheck,
  UserCog,
  UserPlus,
  User as UserIcon,
} from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { buttonStyles, cn, type ActionMenuItem } from "@/src/core/ui";
import type {
  ChangeUserRoleBody,
  InviteUserBody,
  SuspendUserBody,
} from "../../schemas/admin-users.schemas";
import { adminUserHref } from "../../nav-items";
import type {
  AdminUser,
  AdminUsersData,
  UserTabKey,
} from "../../types/admin-users";
import {
  matchesTab,
  matchesUserSearch,
  sortUsers,
  USER_TABS,
  type UserSort,
} from "../../utils/user-display";
import {
  ChangeRoleDialog,
  InviteUserDialog,
  SuspendUserDialog,
} from "./UserDialogs";
import { UserFilters, type RoleFilter, type StatusFilter } from "./UserFilters";
import { userTabId, UserTabs } from "./UserTabs";
import { UsersTable } from "./UsersTable";

type AdminUsersProps = {
  data: AdminUsersData;
  // TODO(API): until the admin users endpoints exist nothing is sent. Planned: invite = create
  // account + setup email (speaker/organizer/admin), role = change the user's one role,
  // suspend / reactivate = set users.status, resend setup = ADM-6 resend invite.
  onInvite?: (body: InviteUserBody) => void;
  onChangeRole?: (userId: string, body: ChangeUserRoleBody) => void;
  onSuspend?: (userId: string, body: SuspendUserBody) => void;
  onReactivate?: (userId: string) => void;
  onResendSetup?: (userId: string) => void;
  onPageChange?: (page: number) => void;
};

/** The one dialog that is open, if any, and the user it is about. */
type OpenDialog =
  { kind: "invite" } | { kind: "role" | "suspend"; user: AdminUser };

const PANEL_ID = "users-panel";
const noop = () => undefined;

/**
 * The admin's Users page: every account, filtered by tab, search, role and status, with a row menu
 * (view profile, change role, resend setup link, suspend / reactivate) and an invite dialog.
 * Filtering here works on the rows loaded.
 * TODO(API): tab, search, filters, sort and paging become query parameters of the list endpoint.
 */
export function AdminUsers({
  data,
  onInvite = noop,
  onChangeRole = noop,
  onSuspend = noop,
  onReactivate = noop,
  onResendSetup = noop,
  onPageChange = noop,
}: AdminUsersProps) {
  const [tab, setTab] = useState<UserTabKey>("all");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("any");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [sort, setSort] = useState<UserSort>("newest");
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setDialog(null), []);

  const isFiltered = search.trim() !== "" || role !== "any" || status !== "any";
  const users = sortUsers(
    data.users.filter(
      (user) =>
        matchesTab(user, tab) &&
        matchesUserSearch(user, search) &&
        (role === "any" || user.role === role) &&
        (status === "any" || user.status === status),
    ),
    sort,
  );

  const menuItems = (user: AdminUser): ActionMenuItem[] => [
    { label: "View profile", href: adminUserHref(user.id), icon: UserIcon },
    {
      label: "Change role",
      icon: UserCog,
      onSelect: () => setDialog({ kind: "role", user }),
    },
    // Only an account that has not set a password yet has a setup link to send.
    ...(user.status === "pending"
      ? [
          {
            label: "Send password setup link",
            icon: Mail,
            onSelect: () => onResendSetup(user.id),
          },
        ]
      : []),
    user.status === "suspended"
      ? {
          label: "Reactivate user",
          icon: UserCheck,
          separatorBefore: true,
          onSelect: () => onReactivate(user.id),
        }
      : {
          label: "Suspend user",
          icon: Ban,
          tone: "danger",
          separatorBefore: true,
          onSelect: () => setDialog({ kind: "suspend", user }),
        },
  ];

  const closeDialog = () => setDialog(null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted">
            Every account on EventSphere. Roles decide which menus and actions
            each person sees.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "invite" })}
          className={cn(buttonStyles(), "gap-2")}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          Invite user
        </button>
      </header>

      <UserTabs
        tabs={USER_TABS}
        counts={data.counts}
        value={tab}
        onChange={setTab}
        panelId={PANEL_ID}
      />

      <UserFilters
        search={search}
        onSearchChange={setSearch}
        role={role}
        onRoleChange={setRole}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
      />

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={userTabId(PANEL_ID, tab)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        <UsersTable
          users={users}
          asOf={data.asOf}
          // A search or filter works on the loaded rows, so the total is what matched.
          total={isFiltered ? users.length : data.counts[tab]}
          page={isFiltered ? 1 : data.page.page}
          pageSize={data.page.pageSize}
          onPageChange={onPageChange}
          isFiltered={isFiltered}
          menuItems={menuItems}
        />
      </div>

      <InviteUserDialog
        open={dialog?.kind === "invite"}
        onClose={closeDialog}
        onConfirm={(body) => {
          onInvite(body);
          closeDialog();
        }}
      />
      <ChangeRoleDialog
        user={dialog?.kind === "role" ? dialog.user : null}
        onClose={closeDialog}
        onConfirm={(body) => {
          if (dialog?.kind === "role") onChangeRole(dialog.user.id, body);
          closeDialog();
        }}
      />
      <SuspendUserDialog
        user={dialog?.kind === "suspend" ? dialog.user : null}
        onClose={closeDialog}
        onConfirm={(body) => {
          if (dialog?.kind === "suspend") onSuspend(dialog.user.id, body);
          closeDialog();
        }}
      />
    </div>
  );
}
