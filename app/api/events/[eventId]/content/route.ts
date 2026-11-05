import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  eventContentResponseSchema,
  eventIdParam,
  updateEventContentBodySchema,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// The descriptive half of an event (tagline, about, venue guide, highlights, FAQs, SEO and
// the images), kept in Strapi. Who may use it (EVENT_MANAGE_OWN: own events only, or
// EVENT_MANAGE_ALL) is decided by the service: someone else's event is a 404.

// The edit form's current values.
export const GET = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const content = await eventService.getContent(eventId, currentUser);
    return ok(eventContentResponseSchema.parse(content));
  },
);

// Saves only the fields that were sent. Images have their own routes (cover, gallery).
export const PATCH = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const body = await parseBody(req, updateEventContentBodySchema);
    const content = await eventService.updateContent(
      eventId,
      body,
      currentUser,
    );
    return ok(eventContentResponseSchema.parse(content));
  },
);
