import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { MyEvents } from "@/src/features/events";

export const metadata: Metadata = { title: "My events" };

// Organizers (their own events) and admins (any event): a guest sees "log in", anyone else
// without either permission "no access". The API checks the same permissions.
export default function MyEventsPage() {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      <MyEvents />
    </PermissionGate>
  );
}
