import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { SchedulePage } from "@/src/features/schedule";

export const metadata: Metadata = { title: "My schedule" };

// Any signed-in attendee or speaker: SCHEDULE_MANAGE is "add or remove sessions in own personal
// schedule" (user and speaker roles). Shows sample data until the agenda API exists; the API
// will check the same permission and that the agenda is the caller's own.
export default function MySchedulePage() {
  return (
    <PermissionGate permissions={["SCHEDULE_MANAGE"]}>
      <SchedulePage />
    </PermissionGate>
  );
}
