import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  sessionParams,
  sessionResponseSchema,
  updateSessionBodySchema,
} from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// One session of the event, for the edit form. A session of another event is a 404.
export const GET = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const session = await sessionService.getSession(
      eventId,
      sessionId,
      currentUser,
    );
    return ok(sessionResponseSchema.parse(session));
  },
);

// Edits or moves a session: only the fields that were sent change (`null` clears the hall or the
// join link). SESSION_MANAGE is checked by the wrapper; the service checks the event is the
// caller's and the session is in it, that the merged result is valid, and that the hall is free
// (409 HALL_BUSY; the session's own old slot does not count). Speakers and Strapi content have
// their own routes.
export const PATCH = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const body = await parseBody(req, updateSessionBodySchema);
    const session = await sessionService.updateSession(
      eventId,
      sessionId,
      body,
      currentUser,
    );
    return ok(sessionResponseSchema.parse(session));
  },
);
