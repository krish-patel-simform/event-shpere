import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventSessionDetail } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Session" };

// One session of an event: its facts and who booked a seat. The same people as the event's other
// pages: organizers (their own events) and admins (any event). The API checks again: someone
// else's event or session is a 404, and the attendee list needs REGISTRATION_VIEW_EVENT or _ALL.
export default function EventSessionPage(
  props: PageProps<"/organizer/events/[eventId]/sessions/[sessionId]">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <SessionSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function SessionSection({
  params,
}: Pick<
  PageProps<"/organizer/events/[eventId]/sessions/[sessionId]">,
  "params"
>) {
  const { eventId, sessionId } = await params;
  return <EventSessionDetail eventId={eventId} sessionId={sessionId} />;
}
