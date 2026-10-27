import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { ADMIN_USERS_SAMPLE, AdminUsers } from "@/src/features/dashboard";

export const metadata: Metadata = { title: "Users" };

// Admin only: the list is read with USER_VIEW; role and status changes need their own permissions.
// A guest sees "log in", anyone else without them "no access". Sample data until the page is wired.
export default function AdminUsersPage() {
  return (
    <PermissionGate
      permissions={["USER_VIEW", "USER_ROLE_MANAGE", "USER_STATUS_MANAGE"]}
    >
      <AdminUsers data={ADMIN_USERS_SAMPLE} />
    </PermissionGate>
  );
}
