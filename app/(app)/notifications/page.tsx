import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { Notifications } from "@/src/features/notifications";

export const metadata: Metadata = { title: "Notifications" };

// Every signed-in role has NOTIFICATION_VIEW. A guest sees "log in", anyone else without it "no
// access". The API checks the same permission.
export default function NotificationsPage() {
  return (
    <PermissionGate permissions={["NOTIFICATION_VIEW"]}>
      <Notifications />
    </PermissionGate>
  );
}
