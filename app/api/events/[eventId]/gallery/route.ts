import { ok, parseInput, route } from "@/src/core/http";
import {
  eventGalleryResponseSchema,
  eventIdParam,
} from "@/src/features/events";
import { eventService, readImageUpload } from "@/src/features/events/server";

// Adds ONE image to the event's gallery (at most 10; a full gallery is a 409). Streamed to
// Strapi like the cover. Returns the whole gallery.
export const POST = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const upload = readImageUpload(req);
    const gallery = await eventService.addGalleryImage(
      eventId,
      upload,
      currentUser,
    );
    return ok(eventGalleryResponseSchema.parse(gallery));
  },
);
