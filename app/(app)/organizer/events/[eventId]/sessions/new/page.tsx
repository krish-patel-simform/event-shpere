import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AddSession } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Add session" };

// Only the event's organizer adds sessions (an admin views them, never changes them). A guest sees
// "log in", anyone else "no access". The API checks the same permission and that the event is
// the organizer's own: someone else's event is a 404.
export default function AddSessionPage(
  props: PageProps<"/organizer/events/[eventId]/sessions/new">,
) {
  return (
    <PermissionGate permissions={["SESSION_CREATE", "EVENT_MANAGE_OWN"]}>
      {/* params is request data: with cacheComponents it must be read inside Suspense. */}
      <Suspense fallback={null}>
        <AddSessionSection params={props.params} />
      </Suspense>
    </PermissionGate>
  );
}

async function AddSessionSection({
  params,
}: Pick<PageProps<"/organizer/events/[eventId]/sessions/new">, "params">) {
  const { eventId } = await params;
  return <AddSession eventId={eventId} />;
}
