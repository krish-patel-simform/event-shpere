import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  replaceSessionSpeakersBodySchema,
  sessionParams,
  sessionResponseSchema,
} from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// Replaces who presents the session: the whole list is sent, whoever is not in it is removed.
// SESSION_MANAGE is checked by the wrapper; the service checks the event is the caller's and the
// session is in it (a foreign one is a 404), that every id is a real speaker profile (400), and
// that the session is not cancelled or ended (409). Strapi content is not touched.
export const PUT = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const body = await parseBody(req, replaceSessionSpeakersBodySchema);
    const session = await sessionService.replaceSpeakers(
      eventId,
      sessionId,
      body,
      currentUser,
    );
    return ok(sessionResponseSchema.parse(session));
  },
);
