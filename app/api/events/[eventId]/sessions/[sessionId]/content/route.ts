import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  sessionContentResponseSchema,
  sessionParams,
  updateSessionContentBodySchema,
} from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// The descriptive half of a session (description, prerequisites, resources), kept in Strapi.
// SESSION_MANAGE is checked by the wrapper; the service checks the event is the caller's and
// the session is in it (a foreign event or session is a 404). The Strapi id comes from the
// session's row, never from the request.

// The content form's current values.
export const GET = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const content = await sessionService.getContent(
      eventId,
      sessionId,
      currentUser,
    );
    return ok(sessionContentResponseSchema.parse(content));
  },
);

// Saves only the fields that were sent. The cover image has its own route.
export const PATCH = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const body = await parseBody(req, updateSessionContentBodySchema);
    const content = await sessionService.updateContent(
      eventId,
      sessionId,
      body,
      currentUser,
    );
    return ok(sessionContentResponseSchema.parse(content));
  },
);
