import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import {
  ADMIN_ORGANIZERS_SAMPLE,
  AdminOrganizers,
} from "@/src/features/dashboard";

export const metadata: Metadata = { title: "Organizers" };

// Admin only: the list is read with ORGANIZER_MANAGE and decisions need ORGANIZER_VERIFY. A guest
// sees "log in", anyone else without them "no access". Sample data until the page is wired.
export default function AdminOrganizersPage() {
  return (
    <PermissionGate permissions={["ORGANIZER_MANAGE", "ORGANIZER_VERIFY"]}>
      <AdminOrganizers data={ADMIN_ORGANIZERS_SAMPLE} />
    </PermissionGate>
  );
}
