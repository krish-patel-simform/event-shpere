"use client";

import { useContext } from "react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import {
  PermissionContext,
  type PermissionContextValue,
} from "../components/PermissionProvider";

/**
 * The signed-in user's permission checks. Check `isLoading` before showing "no access": every
 * check is false until the user has loaded.
 */
export function usePermissions(): PermissionContextValue {
  const value = useContext(PermissionContext);
  if (!value) {
    throw new Error("usePermissions must be used inside <PermissionProvider>");
  }
  return value;
}

export function useHasPermission(code: PermissionCode): boolean {
  return usePermissions().hasPermission(code);
}

export function useHasAnyPermission(codes: readonly PermissionCode[]): boolean {
  return usePermissions().hasAnyPermission(codes);
}

export function useHasAllPermissions(
  codes: readonly PermissionCode[],
): boolean {
  return usePermissions().hasAllPermissions(codes);
}
