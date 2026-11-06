import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { eventIdParam, eventResponseSchema } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// Publishes a draft event so attendees can find it. Only the organizer who owns it: the wrapper
// requires EVENT_PUBLISH_OWN (an admin holds EVENT_PUBLISH_ALL only, so gets a 403), and the
// service checks the event is the caller's (someone else's is a 404). The service re-checks that
// the event is ready (venue with halls, a description, a live session, no session still a
// draft); if not, 409 EVENT_NOT_READY lists what is missing. Publishing twice answers the
// published event again; a cancelled or ended event is a 409.
export const POST = route<{ eventId: string }>(
  { permission: [PERMISSION.EVENT_PUBLISH_OWN] },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const event = await eventService.publishEvent(eventId, currentUser);
    return ok(eventResponseSchema.parse(event));
  },
);
