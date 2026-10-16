import "server-only";
import type { RoleName } from "../../../db/schemas";
import { permissionRepository } from "./permission.repository";

/**
 * What the role may do, read fresh from role_permissions. Plain strings: the typed check
 * is `assertPermission(user, permission: PermissionCode)`, so routes can still only ask
 * for real permission codes.
 */
export async function loadPermissions(
  role: RoleName,
): Promise<ReadonlySet<string>> {
  return new Set(await permissionRepository.findPermissionKeysByRole(role));
}
