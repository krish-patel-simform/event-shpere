import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { AddSession } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Add session" };

// Only an organizer adds sessions (admins manage them but do not create). A guest sees "log in",
// anyone else "no access". The API checks the same permission and that the event is the
// organizer's own: someone else's event is a 404.
export default function AddSessionPage(
  props: PageProps<"/organizer/events/[eventId]/sessions/new">,
) {
  return (
    <PermissionGate permissions={["SESSION_CREATE"]}>
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
