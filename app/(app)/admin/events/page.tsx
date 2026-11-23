import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { ManageEvents } from "@/src/features/events";

export const metadata: Metadata = { title: "Manage events" };

// Admin only (EVENT_MANAGE_ALL): every organizer's events. A guest sees "log in", anyone else
// "no access". The API (GET /api/me/events) checks the permission again.
export default function AdminEventsPage() {
  return (
    <PermissionGate permissions={["EVENT_MANAGE_ALL"]}>
      <ManageEvents />
    </PermissionGate>
  );
}
