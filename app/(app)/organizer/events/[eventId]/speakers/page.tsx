import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventSpeakers } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Event speakers" };

// Same access as the event's overview: organizers (their own events) and admins (any event). The
// rows are the speakers of this event's sessions.
export default function EventSpeakersPage(
  props: PageProps<"/organizer/events/[eventId]/speakers">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <SpeakersSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function SpeakersSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/speakers">, "params">) {
  const { eventId } = await params;
  return <EventSpeakers eventId={eventId} />;
}
