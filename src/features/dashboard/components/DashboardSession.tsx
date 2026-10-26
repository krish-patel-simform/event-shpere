"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Alert, Button } from "@/src/core/ui";
import {
  AUTH_ROUTES,
  PermissionProvider,
  useLogout,
  useMe,
} from "@/src/features/auth";
import { roleLabel } from "../utils/role-label";
import { DashboardShell } from "./DashboardShell";

function SessionLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid min-h-dvh place-items-center bg-canvas"
    >
      <div className="w-64 animate-pulse space-y-3 motion-reduce:animate-none">
        <div className="h-8 w-40 rounded bg-surface-subtle" />
        <div className="h-4 rounded bg-surface-subtle" />
        <div className="h-4 w-3/4 rounded bg-surface-subtle" />
      </div>
    </div>
  );
}

/**
 * Loads the user (GET /api/auth/me) and shows the shell with them. Nobody signed in (401) is a
 * guest: the shell shows log in / sign up, public pages work, and private pages are closed by
 * their PermissionGate. Any other failure offers a retry.
 */
export function DashboardSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const logout = useLogout();
  // Once logged out the user is gone from the cache; without `enabled: false` this component,
  // still on screen until the redirect lands, would fetch /me again.
  const {
    data: me,
    error,
    isPending,
    refetch,
    isRefetching,
  } = useMe({ enabled: !logout.isSuccess });
  const isGuest = error?.status === 401;

  const handleLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => router.replace(AUTH_ROUTES.login),
    });

  // Logged out: show nothing of the signed-in area while the redirect to log in happens.
  if (logout.isSuccess) return <SessionLoading label="Signing out" />;

  // A 401 is not a failure: it is a guest, shown below.
  if (error && !isGuest) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-4">
        <Alert
          tone="error"
          title="We couldn't load your account"
          className="max-w-md"
        >
          Check your connection and try again.
          <Button
            variant="secondary"
            onClick={() => refetch()}
            isPending={isRefetching}
            className="mt-3"
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  if (isPending) return <SessionLoading label="Loading" />;

  // Only here, once /me has answered (user or guest): the provider reuses this cache entry (no
  // second request), and it unmounts on the screens above, so it never fetches /me after logout.
  // A 401 after a refetch keeps the old `me` in the cache: a guest must not show it.
  return (
    <PermissionProvider>
      <DashboardShell
        user={
          me && !isGuest
            ? {
                name: `${me.firstName} ${me.lastName}`,
                roleLabel: roleLabel(me.role),
              }
            : null
        }
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
        logoutFailed={logout.isError}
      >
        {children}
      </DashboardShell>
    </PermissionProvider>
  );
}
