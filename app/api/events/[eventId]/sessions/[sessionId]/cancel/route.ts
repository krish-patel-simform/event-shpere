import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { sessionParams, sessionResponseSchema } from "@/src/features/sessions";
import { sessionService } from "@/src/features/sessions/server";

// Cancels a session (it is kept, not deleted): its hall is free again and the seats booked for it
// are cancelled with it. Final: there is no way back. SESSION_MANAGE is checked by the wrapper;
// the service checks the event is the caller's and the session is in it (a foreign one is a 404).
// Cancelling twice answers the cancelled session again; one that has ended is a 409.
export const POST = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.SESSION_MANAGE] },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(sessionParams, await params);
    const session = await sessionService.cancelSession(
      eventId,
      sessionId,
      currentUser,
    );
    return ok(sessionResponseSchema.parse(session));
  },
);
