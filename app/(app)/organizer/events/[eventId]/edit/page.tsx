import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventFormPage, parseEventStep } from "@/src/features/events";

export const metadata: Metadata = { title: "Edit event" };

// Only the event's organizer edits it (EVENT_MANAGE_OWN). An admin may view any event but not
// change it, so an admin who opens this address sees "no access", as a guest sees "log in". The
// API checks the same: an admin's change is 403 EVENT_READ_ONLY, someone else's event is a 404.
export default function EditEventPage(
  props: PageProps<"/organizer/events/[eventId]/edit">,
) {
  return (
    <PermissionGate permissions={["EVENT_MANAGE_OWN"]}>
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
  PageProps<"/organizer/events/[eventId]/edit">,
  "params" | "searchParams"
>) {
  const { eventId } = await params;
  // ?step=content or ?step=media; anything else is the first step.
  const { step } = await searchParams;
  return <EventFormPage eventId={eventId} step={parseEventStep(step)} />;
}
