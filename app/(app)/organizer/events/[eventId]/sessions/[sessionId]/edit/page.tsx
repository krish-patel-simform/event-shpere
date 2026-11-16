import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EditSession, parseSessionStep } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Edit session" };

// Organizers (their own events) and admins (any event) manage sessions. A guest sees "log in",
// anyone else "no access". The API checks the same permission and that the event is the
// organizer's own: someone else's event or session is a 404.
export default function EditSessionPage(
  props: PageProps<"/organizer/events/[eventId]/sessions/[sessionId]/edit">,
) {
  return (
    <PermissionGate permissions={["SESSION_MANAGE"]}>
      {/* params and searchParams are request data: with cacheComponents they must be read inside Suspense. */}
      <Suspense fallback={null}>
        <EditSection params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </PermissionGate>
  );
}

async function EditSection({
  params,
  searchParams,
}: Pick<
  PageProps<"/organizer/events/[eventId]/sessions/[sessionId]/edit">,
  "params" | "searchParams"
>) {
  const { eventId, sessionId } = await params;
  // ?step=content or cover; anything else is the first step.
  const { step } = await searchParams;
  return (
    <EditSession
      eventId={eventId}
      sessionId={sessionId}
      step={parseSessionStep(step)}
    />
  );
}
