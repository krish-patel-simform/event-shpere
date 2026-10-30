import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { AdminVenueNew } from "@/src/features/venues";

export const metadata: Metadata = { title: "Add venue" };

// Admin only: creating a venue (and its halls) needs VENUE_MANAGE. The API checks it again.
export default function AdminVenueNewPage() {
  return (
    <PermissionGate permissions={["VENUE_MANAGE"]}>
      <AdminVenueNew />
    </PermissionGate>
  );
}
