import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionGate } from "@/src/features/auth";
import { EventFormPage, parseEventStep } from "@/src/features/events";

export const metadata: Metadata = { title: "Edit event" };

// Organizers (their own events) and admins (any event). A guest sees "log in", anyone else
// without either permission "no access". The API checks the same permissions and ownership.
export default function EditEventPage(
  props: PageProps<"/organizer/events/[eventId]/edit">,
) {
  return (
    <PermissionGate
      permissions={["EVENT_MANAGE_OWN", "EVENT_MANAGE_ALL"]}
      match="any"
    >
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
