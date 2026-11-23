import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { ManageSessions } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Manage sessions" };

// Admin only (EVENT_MANAGE_ALL, like Manage events). The page shows sample data until an API
// lists every session; the real sessions are reached through Manage events.
export default function AdminSessionsPage() {
  return (
    <PermissionGate permissions={["EVENT_MANAGE_ALL"]}>
      <ManageSessions />
    </PermissionGate>
  );
}
