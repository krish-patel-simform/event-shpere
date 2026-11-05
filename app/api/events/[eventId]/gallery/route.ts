import { ok, parseInput, route } from "@/src/core/http";
import {
  eventGalleryResponseSchema,
  eventIdParam,
} from "@/src/features/events";
import { eventService, readImageUpload } from "@/src/features/events/server";

// Adds ONE OR MORE images to the event's gallery in one request (at most 10 in all; too many, or
// a full gallery, is a 409 and none is kept). Streamed to Strapi like the cover. Returns the
// whole gallery.
export const POST = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const upload = readImageUpload(req);
    const gallery = await eventService.addGalleryImages(
      eventId,
      upload,
      currentUser,
    );
    return ok(eventGalleryResponseSchema.parse(gallery));
  },
);
