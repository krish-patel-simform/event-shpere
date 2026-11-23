import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventCheckIn } from "@/src/features/events";

export const metadata: Metadata = { title: "Event check-in" };

// Who may check people in: an organizer at their own events, an admin at any event. The server
// checks the same permissions (and the event's owner) on every code.
export default function EventCheckInPage(
  props: PageProps<"/organizer/events/[eventId]/check-in">,
) {
  return (
    <PermissionGate
      permissions={["REGISTRATION_CHECKIN_EVENT", "REGISTRATION_CHECKIN_ALL"]}
      match="any"
    >
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <CheckInSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function CheckInSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/check-in">, "params">) {
  const { eventId } = await params;
  return <EventCheckIn eventId={eventId} />;
}
