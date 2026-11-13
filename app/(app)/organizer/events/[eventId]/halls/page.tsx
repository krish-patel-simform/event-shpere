import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventHalls } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Event halls" };

// Same access as the event's overview: organizers (their own events) and admins (any event). The
// halls come from the event's venue (GET /api/venues/[id]), the counts from its sessions.
export default function EventHallsPage(
  props: PageProps<"/organizer/events/[eventId]/halls">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <HallsSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function HallsSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/halls">, "params">) {
  const { eventId } = await params;
  return <EventHalls eventId={eventId} />;
}
