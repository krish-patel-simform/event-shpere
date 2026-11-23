import { created, parseBody, parseInput, route } from "@/src/core/http";
import {
  checkInBodySchema,
  sessionBookingParam,
  sessionCheckInResponseSchema,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// Checks a booked person in at the door of ONE session by typing their ticket code.
// REGISTRATION_CHECKIN_EVENT reaches only the organizer's own events (someone else's is a 404,
// never a 403), REGISTRATION_CHECKIN_ALL any event; the service decides, not the route, because a
// route's `permission` list needs every permission and the organizer and the admin hold different
// ones. The body is ONLY the code: the event and session are in the URL and who checks in is the
// login; the code only says WHO is at the door. A code of another event or an unknown code is a
// 404, a person with no seat in this session (a cancelled ticket has none) 409 SESSION_NOT_BOOKED,
// a person who has not come through the event door today 409 EVENT_CHECK_IN_REQUIRED, a repeat 409
// ALREADY_CHECKED_IN, a cancelled session 409 SESSION_CANCELLED, and outside the window (2 hours
// before the session starts until it ends) 409 CHECK_IN_NOT_OPEN / CHECK_IN_CLOSED.
export const POST = route<{ eventId: string; sessionId: string }>(
  { auth: "signed-in", rateLimit: "user-write" },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(
      sessionBookingParam,
      await params,
    );
    const body = await parseBody(req, checkInBodySchema);
    const checkIn = await registrationService.checkInToSession(
      eventId,
      sessionId,
      body,
      currentUser,
    );
    return created(sessionCheckInResponseSchema.parse(checkIn));
  },
);
