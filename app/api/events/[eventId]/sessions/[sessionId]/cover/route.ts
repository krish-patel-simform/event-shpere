import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { noContent, ok, parseInput, route } from "@/src/core/http";
import {
  sessionCoverResponseSchema,
  sessionParams,
} from "@/src/features/sessions";
import {
  readCoverUpload,
  sessionService,
} from "@/src/features/sessions/server";

// Sets or replaces the session's cover image. The multipart body (file field "files") is
// streamed straight on to Strapi: it is never read into memory or stored on this server.
// SESSION_MANAGE is checked by the wrapper; the service checks the event is the caller's and
// the session is in it, before a single byte moves.
export const POST = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const upload = readCoverUpload(req);
    const cover = await sessionService.replaceCover(
      eventId,
      sessionId,
      upload,
      currentUser,
    );
    return ok(sessionCoverResponseSchema.parse(cover));
  },
);

// Removes the cover image (also fine when there is none).
export const DELETE = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    await sessionService.removeCover(eventId, sessionId, currentUser);
    return noContent();
  },
);
