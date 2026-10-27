"use client";

import Link from "next/link";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  Alert,
  Breadcrumb,
  Button,
  buttonStyles,
  type BreadcrumbItem,
} from "@/src/core/ui";
import { useGetUserDetail } from "../hooks/useGetUserDetail";
import { useReactivateUser } from "../hooks/useReactivateUser";
import { useSendResetLink } from "../hooks/useSendResetLink";
import { useSuspendUser } from "../hooks/useSuspendUser";
import { USER_ROUTES } from "../routes";
import type { UserDetailDto } from "../schemas/users.schema";
import { userFullName } from "../utils/user-display";
import {
  AccountCard,
  AdminActionsCard,
  ProfileHeaderCard,
  RolesCard,
} from "./UserDetailCards";
import { SendResetLinkDialog, SuspendUserDialog } from "./UserDialogs";

const USERS_CRUMB: BreadcrumbItem = {
  label: "Users",
  href: USER_ROUTES.list,
};

/**
 * The admin's page for one user, whatever their role: their account, their role and what it
 * allows, and the actions an admin can take (suspend or reactivate, send a password reset link).
 * It loads the user from GET /api/admin/users/[id]. What an organizer or a speaker adds on top
 * (the application, the speaker profile) is on their own pages, not here.
 */
export function AdminUserDetail({ userId }: { userId: string }) {
  const detail = useGetUserDetail(userId);

  if (detail.isPending) {
    return (
      <PageFrame crumb="User profile">
        <div
          role="status"
          aria-label="Loading user"
          className="animate-pulse space-y-4 motion-reduce:animate-none"
        >
          <div className="h-28 rounded-lg bg-surface-subtle" />
          <div className="h-48 rounded-lg bg-surface-subtle" />
        </div>
      </PageFrame>
    );
  }

  if (detail.isError) {
    const notFound =
      detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <PageFrame crumb="User profile">
        {notFound ? (
          <Alert tone="warning" title="User not found">
            This user does not exist, or was deleted.
            <Link
              href={USER_ROUTES.list}
              className={buttonStyles({ variant: "secondary" }) + " mt-3"}
            >
              Back to users
            </Link>
          </Alert>
        ) : (
          <Alert tone="error" title="We couldn't load this user">
            {detail.error.message}
            <Button
              variant="secondary"
              onClick={() => void detail.refetch()}
              className="mt-3"
            >
              Try again
            </Button>
          </Alert>
        )}
      </PageFrame>
    );
  }

  return <UserDetailView user={detail.data} />;
}

/** The breadcrumb and the page title, shared by the loading, error and loaded views. */
function PageFrame({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2.5">
        <Breadcrumb items={[USERS_CRUMB, { label: crumb }]} />
        <div>
          <h1 className="text-2xl font-semibold">User profile</h1>
          <p className="text-muted">Account details and role</p>
        </div>
      </div>
      {children}
    </div>
  );
}

type OpenDialog = "suspend" | "reset-link";

function UserDetailView({ user }: { user: UserDetailDto }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  // The message after a reset link was sent.
  const [notice, setNotice] = useState<string | null>(null);

  const suspend = useSuspendUser();
  const reactivate = useReactivateUser();
  const sendResetLink = useSendResetLink();

  // Leaving the page hides it (React <Activity>) instead of unmounting it, so an open dialog
  // would still be open when the admin comes back. Close it as the page is hidden.
  useLayoutEffect(() => () => setDialog(null), []);

  const closeDialog = () => {
    suspend.reset();
    sendResetLink.reset();
    setDialog(null);
  };
  const open = (next: OpenDialog) => {
    setNotice(null);
    setDialog(next);
  };
  const reactivateUser = () => {
    reactivate.reset();
    reactivate.mutate(user.id);
  };

  return (
    <PageFrame crumb={userFullName(user)}>
      {notice && (
        <Alert tone="success" title={notice}>
          They can use it once, then sign in with the new password.
        </Alert>
      )}
      {reactivate.isError && (
        <Alert tone="error" title="We couldn't reactivate this user">
          {reactivate.error.message}
        </Alert>
      )}

      <ProfileHeaderCard
        user={user}
        onSuspend={() => open("suspend")}
        onReactivate={reactivateUser}
        isReactivating={reactivate.isPending}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <AccountCard user={user} />
          <RolesCard user={user} />
        </div>
        <AdminActionsCard
          user={user}
          onSuspend={() => open("suspend")}
          onReactivate={reactivateUser}
          isReactivating={reactivate.isPending}
          onSendResetLink={() => open("reset-link")}
        />
      </div>

      <SuspendUserDialog
        user={dialog === "suspend" ? user : null}
        isPending={suspend.isPending}
        error={suspend.error?.message}
        onClose={closeDialog}
        onConfirm={() => suspend.mutate(user.id, { onSuccess: closeDialog })}
      />
      <SendResetLinkDialog
        user={dialog === "reset-link" ? user : null}
        isPending={sendResetLink.isPending}
        error={sendResetLink.error?.message}
        onClose={closeDialog}
        onConfirm={() =>
          sendResetLink.mutate(user.id, {
            onSuccess: () => {
              setNotice(`Reset link sent to ${user.email}`);
              closeDialog();
            },
          })
        }
      />
    </PageFrame>
  );
}
