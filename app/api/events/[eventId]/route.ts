import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  eventIdParam,
  eventOverviewSchema,
  eventResponseSchema,
  updateEventBodySchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// One event with the figures its overview page shows. EVENT_MANAGE_OWN reaches only the
// organizer's own events (someone else's is a 404), EVENT_MANAGE_ALL any event: the service
// decides, so a foreign id never says whether the event exists.
export const GET = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const overview = await eventService.getEventOverview(eventId, currentUser);
    return ok(eventOverviewSchema.parse(overview));
  },
);

// Changes the fields that were sent (title, dates, venue, capacity, price). What may change
// depends on the event: see eventService.updateEvent. The slug never changes.
export const PATCH = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const body = await parseBody(req, updateEventBodySchema);
    const event = await eventService.updateEvent(eventId, body, currentUser);
    return ok(eventResponseSchema.parse(event));
  },
);
