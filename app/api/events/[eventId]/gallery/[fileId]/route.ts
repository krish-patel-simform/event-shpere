import { ok, parseInput, route } from "@/src/core/http";
import {
  eventGalleryResponseSchema,
  galleryImageParam,
} from "@/src/features/events";
import { eventService } from "@/src/features/events/server";

// Removes one image from this event's gallery. An id that is not in THIS gallery is a 404, so
// no other event's file can be deleted here. Returns the remaining gallery.
export const DELETE = route<{ eventId: string; fileId: string }>(
  { auth: "signed-in" },
  async ({ params, currentUser }) => {
    const { eventId, fileId } = parseInput(galleryImageParam, await params);
    const gallery = await eventService.removeGalleryImage(
      eventId,
      fileId,
      currentUser,
    );
    return ok(eventGalleryResponseSchema.parse(gallery));
  },
);
