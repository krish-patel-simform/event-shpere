import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseInput, route } from "@/src/core/http";
import {
  sessionBookingParam,
  sessionBookingResponseSchema,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// The signed-in user books a seat in one session. No body: the event and session are in the URL
// and the user is the session's, so nobody can book for someone else. 201 with the booking.
// The user must hold a live registration for the event (409 EVENT_REGISTRATION_REQUIRED), and
// booking stops when the session starts (409 SESSION_STARTED). A repeat is a 409 ALREADY_BOOKED.
// A draft event or session, or a session of another event, is a 404. Also a 409 that names the
// rule: cancelled event or session, a session that needs no booking or has no hall yet, a speaker
// of the session, a full hall, a paid session. An online session has no hall and no seat limit.
export const POST = route<{ eventId: string; sessionId: string }>(
  { permission: [PERMISSION.REGISTRATION_CREATE], rateLimit: "user-write" },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(
      sessionBookingParam,
      await params,
    );
    const booking = await registrationService.bookSession(
      eventId,
      sessionId,
      currentUser,
    );
    return created(sessionBookingResponseSchema.parse(booking));
  },
);
