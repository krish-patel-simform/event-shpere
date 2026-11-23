import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EditSession, parseSessionStep } from "@/src/features/sessions";

export const metadata: Metadata = { title: "Edit session" };

// Only the event's organizer edits its sessions (SESSION_MANAGE with EVENT_MANAGE_OWN); an admin
// views them and gets "no access" here. A guest sees "log in". The API checks the same: an
// admin's change is 403 EVENT_READ_ONLY, someone else's event or session is a 404.
export default function EditSessionPage(
  props: PageProps<"/organizer/events/[eventId]/sessions/[sessionId]/edit">,
) {
  return (
    <PermissionGate permissions={["SESSION_MANAGE", "EVENT_MANAGE_OWN"]}>
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
