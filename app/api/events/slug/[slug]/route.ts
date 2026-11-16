import { ok, parseInput, route } from "@/src/core/http";
import {
  publicEventDetailSchema,
  publicEventSlugParam,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// One event's public page, by its public link (the slug), for guests too. A published event, or
// a cancelled one (it stays visible with a banner). A draft or an unknown link is a 404, so the
// answer never says whether a draft exists. It lives under /slug/ because /api/events/[eventId]
// is the organizer's management view, found by id and limited to the owner (Next also does not
// allow two different dynamic names, [eventId] and [slug], side by side).
export const GET = route<{ slug: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { slug } = parseInput(publicEventSlugParam, await params);
    const event = await eventService.getPublicEvent(slug);
    return ok(publicEventDetailSchema.parse(event));
  },
);
