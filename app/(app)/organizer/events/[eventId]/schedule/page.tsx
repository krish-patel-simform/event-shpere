import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventSchedule } from "@/src/features/events";

export const metadata: Metadata = { title: "Schedule board" };

// Same access as the event's overview: organizers (their own events) and admins (any event). The
// board is sample data until the schedule API exists.
export default function EventSchedulePage(
  props: PageProps<"/organizer/events/[eventId]/schedule">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <ScheduleSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function ScheduleSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/schedule">, "params">) {
  const { eventId } = await params;
  return <EventSchedule eventId={eventId} />;
}
