"use client";

import { Ban, Mail, UserCheck, User as UserIcon } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { useDebouncedValue } from "@/src/core/hooks/use-debounced-value";
import { Alert, Button, tabId, Tabs, type ActionMenuItem } from "@/src/core/ui";
import { useGetUserList } from "../hooks/useGetUserList";
import { useReactivateUser } from "../hooks/useReactivateUser";
import { useResendInvite } from "../hooks/useResendInvite";
import { useSuspendUser } from "../hooks/useSuspendUser";
import { adminUserHref } from "../routes";
import type { UserListItemDto, UserSort } from "../schemas/users.schema";
import type { UserTabKey } from "../types/admin-users";
import { tabFilter, USER_TABS } from "../utils/user-display";
import { SuspendUserDialog } from "./UserDialogs";
import { UserFilters, type StatusFilter } from "./UserFilters";
import { UsersTable } from "./UsersTable";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const PANEL_ID = "users-panel";

/**
 * The admin's Users page: every account, filtered by tab, search and status, sorted and paged by
 * the server (GET /api/admin/users), with a row menu to suspend or reactivate. The tabs are the
 * only way to pick a role (or the suspended status); the Status select, when set, takes
 * precedence over a tab's status.
 */
export function AdminUsers() {
  const [tab, setTab] = useState<UserTabKey>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [sort, setSort] = useState<UserSort>("newest");
  const [page, setPage] = useState(1);
  const [suspendTarget, setSuspendTarget] = useState<UserListItemDto | null>(
    null,
  );

  // The box updates at once; the API is asked once the admin stops typing.
  const term = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  const fromTab = tabFilter(tab);
  const users = useGetUserList({
    role: fromTab.role,
    status: status !== "any" ? status : fromTab.status,
    search: term,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const suspend = useSuspendUser();
  const reactivate = useReactivateUser();
  const resendInvite = useResendInvite();
  // The invite sent last: the message above the list says who got it.
  const [inviteNotice, setInviteNotice] = useState<{
    email: string;
    setupEmailQueued: boolean;
  } | null>(null);

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setSuspendTarget(null), []);

  // A new filter or search starts again from the first page.
  const changed = <T,>(set: (value: T) => void) => {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  };

  const isFiltered = term !== "" || status !== "any" || tab !== "all";

  const closeDialog = () => {
    suspend.reset();
    setSuspendTarget(null);
  };

  const sendInvite = (user: UserListItemDto) => {
    setInviteNotice(null);
    resendInvite.reset();
    resendInvite.mutate(user.id, {
      onSuccess: (result) =>
        setInviteNotice({
          email: user.email,
          setupEmailQueued: result.setupEmailQueued,
        }),
    });
  };

  /** What each row's menu offers. The server refuses the rest, too (not an admin, not yourself). */
  const menuItems = (user: UserListItemDto): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      { label: "View profile", href: adminUserHref(user.id), icon: UserIcon },
    ];
    if (user.status === "active" && user.role !== "admin") {
      items.push({
        label: "Suspend user",
        icon: Ban,
        tone: "danger",
        separatorBefore: true,
        onSelect: () => setSuspendTarget(user),
      });
    }
    if (user.status === "pending") {
      items.push({
        label: "Resend invite",
        icon: Mail,
        separatorBefore: true,
        onSelect: () => sendInvite(user),
      });
    }
    if (user.status === "suspended") {
      items.push({
        label: "Reactivate user",
        icon: UserCheck,
        separatorBefore: true,
        onSelect: () => reactivate.mutate(user.id),
      });
    }
    return items;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted">
          Every account on EventSphere. Roles decide which menus and actions
          each person sees.
        </p>
      </header>

      <Tabs
        label="Filter users"
        tabs={USER_TABS}
        value={tab}
        onChange={changed(setTab)}
        panelId={PANEL_ID}
      />

      <UserFilters
        search={search}
        onSearchChange={changed(setSearch)}
        status={status}
        onStatusChange={changed(setStatus)}
        sort={sort}
        onSortChange={changed(setSort)}
      />

      {inviteNotice &&
        (inviteNotice.setupEmailQueued ? (
          <Alert tone="success" title={`Invite sent to ${inviteNotice.email}`}>
            The earlier link no longer works. They set a password from this one.
          </Alert>
        ) : (
          <Alert
            tone="warning"
            title="The new invite was saved, but the email was not sent"
          >
            We couldn&apos;t queue the email to {inviteNotice.email}. Try again
            in a minute.
          </Alert>
        ))}
      {resendInvite.isError && (
        <Alert tone="error" title="We couldn't send the invite">
          {resendInvite.error.message}
        </Alert>
      )}
      {reactivate.isError && (
        <Alert tone="error" title="We couldn't reactivate this user">
          {reactivate.error.message}
        </Alert>
      )}

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(PANEL_ID, tab)}
        className="overflow-hidden rounded-lg border border-line bg-surface"
      >
        {users.isPending ? (
          <div
            role="status"
            aria-label="Loading users"
            className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
          >
            <div className="h-5 rounded bg-surface-subtle" />
            <div className="h-5 w-11/12 rounded bg-surface-subtle" />
            <div className="h-5 w-3/4 rounded bg-surface-subtle" />
          </div>
        ) : users.isError && !users.data ? (
          <div className="p-5">
            <Alert tone="error" title="We couldn't load the users">
              {users.error.message}
              <Button
                variant="secondary"
                onClick={() => void users.refetch()}
                className="mt-3"
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : (
          <UsersTable
            users={users.data?.items ?? []}
            total={users.data?.meta.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isFiltered={isFiltered}
            menuItems={menuItems}
          />
        )}
      </div>

      <SuspendUserDialog
        user={suspendTarget}
        isPending={suspend.isPending}
        error={suspend.error?.message}
        onClose={closeDialog}
        onConfirm={() => {
          if (suspendTarget) {
            suspend.mutate(suspendTarget.id, { onSuccess: closeDialog });
          }
        }}
      />
    </div>
  );
}
