import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseBody, route } from "@/src/core/http";
import {
  createEventBodySchema,
  eventResponseSchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// An approved organizer (or an admin) creates an event. It is always saved as a draft owned by
// the caller. Anyone else gets 401/403 from the wrapper or the service.
export const POST = route(
  { permission: [PERMISSION.EVENT_CREATE] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createEventBodySchema);
    const event = await eventService.createEvent(body, currentUser);
    return created(eventResponseSchema.parse(event));
  },
);
