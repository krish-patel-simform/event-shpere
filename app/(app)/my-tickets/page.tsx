import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import { MyTickets } from "@/src/features/registrations";

export const metadata: Metadata = { title: "My tickets" };

// Attendees (roles user and speaker): REGISTRATION_VIEW_OWN. A guest sees "log in"; an organizer
// or admin (no attendee permissions) sees "no access". The API checks the same permission and
// only ever lists the caller's own tickets.
export default function MyTicketsPage() {
  return (
    <PermissionGate permissions={["REGISTRATION_VIEW_OWN"]}>
      <MyTickets />
    </PermissionGate>
  );
}
