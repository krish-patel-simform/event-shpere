import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventOverview } from "@/src/features/events";

export const metadata: Metadata = { title: "Event" };

// Organizers (their own events) and admins (any event). A guest sees "log in", anyone else
// without either permission "no access". The API checks the same permissions and that the event
// is the organizer's own: someone else's event is a 404.
export default function EventOverviewPage(
  props: PageProps<"/organizer/events/[eventId]">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <EventSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function EventSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]">, "params">) {
  const { eventId } = await params;
  return <EventOverview eventId={eventId} />;
}
