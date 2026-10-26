"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { Alert, buttonStyles, cn } from "@/src/core/ui";
import { usePermissions } from "../hooks/usePermissions";
import { AUTH_ROUTES } from "../routes";

type PermissionGateProps = {
  /** Empty (the default) = any signed-in user may see the page. */
  permissions?: readonly PermissionCode[];
  /** "all" (default): every code is needed. "any": one is enough. */
  match?: "all" | "any";
  children: ReactNode;
};

/**
 * Wraps a private page, so opening its URL directly is handled too: loading → skeleton,
 * guest → "log in", signed in without the permission → "no access". Only decides what the UI
 * shows: the API checks the permission again.
 */
export function PermissionGate({
  permissions = [],
  match = "all",
  children,
}: PermissionGateProps) {
  const { isLoading, isGuest, hasAllPermissions, hasAnyPermission } =
    usePermissions();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="mx-auto max-w-4xl animate-pulse space-y-3 motion-reduce:animate-none"
      >
        <div className="h-8 w-48 rounded bg-surface-subtle" />
        <div className="h-4 rounded bg-surface-subtle" />
        <div className="h-4 w-2/3 rounded bg-surface-subtle" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <Alert
        tone="info"
        title="Log in to continue"
        className="mx-auto max-w-md"
      >
        You need an account to see this page.
        <Link href={AUTH_ROUTES.login} className={cn(buttonStyles(), "mt-3")}>
          Log in
        </Link>
      </Alert>
    );
  }

  const allowed =
    match === "any"
      ? hasAnyPermission(permissions)
      : hasAllPermissions(permissions);

  if (!allowed) {
    return (
      <Alert
        tone="warning"
        title="You don't have access"
        className="mx-auto max-w-md"
      >
        This page needs a permission your account does not have.
      </Alert>
    );
  }

  return <>{children}</>;
}
