import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  userRolesTable,
  type RoleName,
} from "../../../db/schemas";

export const permissionRepository = {
  /**
   * The user's role, or null if none is assigned. Each user holds exactly one role; the
   * schema allows more, so the code that assigns roles must never add a second one.
   */
  async findRoleByUserId(userId: string): Promise<RoleName | null> {
    const [row] = await db
      .select({ role: rolesTable.role })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(eq(userRolesTable.userId, userId))
      .limit(1);
    return row?.role ?? null;
  },

  async findPermissionKeysByRole(role: RoleName): Promise<string[]> {
    const rows = await db
      .select({ key: permissionsTable.key })
      .from(rolesTable)
      .innerJoin(
        rolePermissionsTable,
        eq(rolePermissionsTable.roleId, rolesTable.id),
      )
      .innerJoin(
        permissionsTable,
        eq(permissionsTable.id, rolePermissionsTable.permissionId),
      )
      .where(eq(rolesTable.role, role));
    return rows.map((r) => r.key);
  },
};
