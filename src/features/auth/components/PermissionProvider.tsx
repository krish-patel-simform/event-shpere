"use client";

import { createContext, useMemo, type ReactNode } from "react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { useMe } from "../hooks/useMe";
import {
  hasAllPermissionCodes,
  hasAnyPermissionCode,
  hasPermissionCode,
} from "../utils/permission-checks";

export type PermissionContextValue = {
  /** True until GET /api/auth/me has answered once. Every check is false meanwhile. */
  isLoading: boolean;
  /** GET /api/auth/me answered 401: nobody is signed in. False while loading and after other errors. */
  isGuest: boolean;
  hasPermission: (code: PermissionCode) => boolean;
  hasAnyPermission: (codes: readonly PermissionCode[]) => boolean;
  hasAllPermissions: (codes: readonly PermissionCode[]) => boolean;
};

// undefined = no provider above: usePermissions throws instead of silently denying everything.
export const PermissionContext = createContext<
  PermissionContextValue | undefined
>(undefined);

/**
 * What the signed-in user may do, from GET /api/auth/me. It reuses the cached user, so it adds
 * no request when the user is already loaded (DashboardSession). Only decides what the UI shows:
 * the API checks every permission again.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: me, isPending, error } = useMe({ refetchOnMount: false });
  const isGuest = error?.status === 401;

  // No user (loading, failed, guest) = empty set, so every check is false. A refetch that ends
  // in 401 (session expired) keeps the old `me` in the cache, so a guest must ignore it.
  const permissions = isGuest ? undefined : me?.permissions;
  const permissionCodes = useMemo(
    () => new Set(permissions ?? []),
    [permissions],
  );

  // A stable value, so consumers re-render only when the permissions change.
  const value = useMemo<PermissionContextValue>(
    () => ({
      isLoading: isPending,
      isGuest,
      hasPermission: (code) => hasPermissionCode(permissionCodes, code),
      hasAnyPermission: (codes) => hasAnyPermissionCode(permissionCodes, codes),
      hasAllPermissions: (codes) =>
        hasAllPermissionCodes(permissionCodes, codes),
    }),
    [isPending, isGuest, permissionCodes],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}
