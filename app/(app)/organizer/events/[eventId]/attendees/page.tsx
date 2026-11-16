import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventAttendees } from "@/src/features/events";

export const metadata: Metadata = { title: "Event attendees" };

// Same access as the event's overview: organizers (their own events) and admins (any event). The
// numbers and rows are sample data until the registrations API exists.
export default function EventAttendeesPage(
  props: PageProps<"/organizer/events/[eventId]/attendees">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <AttendeesSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function AttendeesSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/attendees">, "params">) {
  const { eventId } = await params;
  return <EventAttendees eventId={eventId} />;
}
