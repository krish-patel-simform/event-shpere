import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { eventIdParam, eventResponseSchema } from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// Cancels a published event. Its sessions are cancelled with it (their halls are free again), and
// so are the seats booked for the sessions and the registrations for the event, in one
// transaction. Final: there is no way back. Only an organizer can do it: the wrapper requires
// EVENT_MANAGE_OWN (an admin has EVENT_MANAGE_ALL only, so gets a 403), and the service checks the
// event is the caller's (someone else's is a 404). Cancelling twice answers the cancelled event
// again; a draft or a completed event is a 409.
export const POST = route<{ eventId: string }>(
  { permission: [PERMISSION.EVENT_MANAGE_OWN] },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const event = await eventService.cancelEvent(eventId, currentUser);
    return ok(eventResponseSchema.parse(event));
  },
);
