import { noContent, ok, parseInput, route } from "@/src/core/http";
import { eventCoverResponseSchema, eventIdParam } from "@/src/features/events";
import { eventService, readImageUpload } from "@/src/features/events/server";

// Sets or replaces the event's cover image. The multipart body (file field "files") is
// streamed straight on to Strapi: it is never read into memory or stored on this server.
export const POST = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const upload = readImageUpload(req);
    const cover = await eventService.replaceCover(eventId, upload, currentUser);
    return ok(eventCoverResponseSchema.parse(cover));
  },
);

// Removes the cover image (also fine when there is none).
export const DELETE = route<{ eventId: string }>(
  { auth: "signed-in" },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    await eventService.removeCover(eventId, currentUser);
    return noContent();
  },
);
