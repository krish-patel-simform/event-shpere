import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventSessions, parseSessionSpeaker } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Event sessions" };

// Organizers (their own events) and admins (any event) manage sessions. A guest sees "log in",
// anyone else "no access". The API checks the same permission and that the event is the
// organizer's own: someone else's event is a 404.
export default function EventSessionsPage(
  props: PageProps<"/organizer/events/[eventId]/sessions">,
) {
  return (
    <PermissionGate permissions={["SESSION_MANAGE"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <SessionsSection
          params={props.params}
          searchParams={props.searchParams}
        />
      </Suspense>
    </PermissionGate>
  );
}

async function SessionsSection({
  params,
  searchParams,
}: Pick<
  PageProps<"/organizer/events/[eventId]/sessions">,
  "params" | "searchParams"
>) {
  const { eventId } = await params;
  // ?speaker=<id> shows only that speaker's sessions; anything else is no filter.
  const { speaker } = await searchParams;
  return (
    <EventSessions eventId={eventId} speakerId={parseSessionSpeaker(speaker)} />
  );
}
