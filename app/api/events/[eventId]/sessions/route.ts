import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, ok, parseBody, parseInput, route } from "@/src/core/http";
import { eventIdParam } from "@/src/features/events";
import {
  createSessionBodySchema,
  sessionListResponseSchema,
  sessionResponseSchema,
} from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// All sessions of one event, earliest first. SESSION_MANAGE is checked by the wrapper; the
// service checks the event is the caller's (someone else's is a 404), an admin may read any.
export const GET = route<{ eventId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const sessions = await sessionService.listSessions(eventId, currentUser);
    return ok(sessionListResponseSchema.parse(sessions));
  },
);

// An approved organizer adds a session (with its speakers) to one of their own events. The
// wrapper checks SESSION_CREATE; the service checks the event is theirs (someone else's is a
// 404), the hall and the speakers are free (409 HALL_BUSY / SPEAKER_BUSY) and creates the content entry in Strapi.
export const POST = route<{ eventId: string }>(
  { permission: [PERMISSION.SESSION_CREATE] },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(eventIdParam, await params);
    const body = await parseBody(req, createSessionBodySchema);
    const session = await sessionService.createSession(
      eventId,
      body,
      currentUser,
    );
    return created(sessionResponseSchema.parse(session));
  },
);
