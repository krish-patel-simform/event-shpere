import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { AdminUsers } from "@/src/features/users";

export const metadata: Metadata = { title: "Users" };

// Admin only: the list is read with USER_VIEW, suspending needs USER_STATUS_MANAGE. A guest sees
// "log in", anyone else without them "no access". The API checks the same permissions.
export default function AdminUsersPage() {
  return (
    <PermissionGate permissions={["USER_VIEW", "USER_STATUS_MANAGE"]}>
      <AdminUsers />
    </PermissionGate>
  );
}
