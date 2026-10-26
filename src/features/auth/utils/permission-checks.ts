import type { PermissionCode } from "@/src/core/auth/permission-catalog";

// Pure checks behind usePermissions. They only decide what the UI shows: every API route
// still checks the permission on the server (assertPermission).

export function hasPermissionCode(
  permissionCodes: ReadonlySet<string>,
  code: PermissionCode,
): boolean {
  return permissionCodes.has(code);
}

/** False for an empty list: nothing asked for, nothing granted. */
export function hasAnyPermissionCode(
  permissionCodes: ReadonlySet<string>,
  codes: readonly PermissionCode[],
): boolean {
  return codes.some((code) => permissionCodes.has(code));
}

/** True for an empty list, the same as the server's assertPermission (Array.every). */
export function hasAllPermissionCodes(
  permissionCodes: ReadonlySet<string>,
  codes: readonly PermissionCode[],
): boolean {
  return codes.every((code) => permissionCodes.has(code));
}
