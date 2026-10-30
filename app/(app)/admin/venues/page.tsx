import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { AdminVenues } from "@/src/features/venues";

export const metadata: Metadata = { title: "Venues" };

// Admin only: venues are managed with VENUE_MANAGE and their halls with HALL_MANAGE. A guest sees
// "log in", anyone else without them "no access". The API checks the same permissions.
export default function AdminVenuesPage() {
  return (
    <PermissionGate permissions={["VENUE_MANAGE", "HALL_MANAGE"]}>
      <AdminVenues />
    </PermissionGate>
  );
}
