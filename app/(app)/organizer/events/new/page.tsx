import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { EventFormPage } from "@/src/features/events";

export const metadata: Metadata = { title: "Create event" };

// Needs EVENT_CREATE (organizers and admins). A guest sees "log in", anyone else "no access".
// The API checks the same permission, and that the organizer is approved.
export default function NewEventPage() {
  return (
    <PermissionGate permissions={["EVENT_CREATE"]}>
      <EventFormPage />
    </PermissionGate>
  );
}
