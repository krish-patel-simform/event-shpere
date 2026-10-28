import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { AdminOrganizers } from "@/src/features/organizer";

export const metadata: Metadata = { title: "Organizers" };

// Admin only: the list is read with ORGANIZER_MANAGE and decisions need ORGANIZER_VERIFY. A guest
// sees "log in", anyone else without them "no access". The API checks the same permissions.
export default function AdminOrganizersPage() {
  return (
    <PermissionGate permissions={["ORGANIZER_MANAGE", "ORGANIZER_VERIFY"]}>
      <AdminOrganizers />
    </PermissionGate>
  );
}
