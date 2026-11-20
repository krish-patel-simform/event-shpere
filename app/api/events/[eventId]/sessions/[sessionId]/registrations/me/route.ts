import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  sessionBookingParam,
  sessionBookingResponseSchema,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// Cancels the user's OWN seat in this session; "me" in the URL and no user id anywhere, so nobody
// can cancel someone else's. Allowed until registration for the event closes (409
// CANCELLATION_CLOSED after); a seat already used to check in is a 409 ALREADY_CHECKED_IN; no
// booking, or a session of another event, is a 404. Cancelling twice answers the cancelled
// booking again. It answers the booking with status "cancelled". Whether the user holds a seat is
// `bookedSessionIds` of `GET /api/events/[eventId]/registrations/me`.
export const DELETE = route<{ eventId: string; sessionId: string }>(
  {
    permission: [PERMISSION.REGISTRATION_MANAGE_OWN],
    rateLimit: "user-write",
  },
  async ({ params, currentUser }) => {
    const { eventId, sessionId } = parseInput(
      sessionBookingParam,
      await params,
    );
    const booking = await registrationService.cancelSessionBooking(
      eventId,
      sessionId,
      currentUser,
    );
    return ok(sessionBookingResponseSchema.parse(booking));
  },
);
