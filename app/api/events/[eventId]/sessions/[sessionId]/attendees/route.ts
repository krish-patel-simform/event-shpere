import {
  paginated,
  parseInput,
  parseQuery,
  PER_USER_HEADERS,
  route,
} from "@/src/core/http";
import {
  attendeeListQuerySchema,
  sessionAttendeeListMetaSchema,
  sessionAttendeeListResponseSchema,
  sessionBookingParam,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// Who holds a seat in ONE session, one page, with whether they checked in to it: searched by
// name, email or ticket code, filtered by seat status and by checked in (`checkedIn=no` is the
// pending list), sorted newest (default), oldest or by name. The query is the event attendee
// list's. REGISTRATION_VIEW_EVENT reaches only the organizer's own events (someone else's is a
// 404, never a 403), REGISTRATION_VIEW_ALL any event; a session of another event is a 404. The
// service decides, not the route, because a route's `permission` list needs every permission and
// the organizer and the admin hold different ones. `meta.counts` covers the whole session. It
// carries names, emails and ticket codes, so no cache may keep it.
export const GET = route<{ eventId: string; sessionId: string }>(
  { auth: "signed-in", rateLimit: "user-read" },
  async ({ req, params, currentUser }) => {
    const { eventId, sessionId } = parseInput(
      sessionBookingParam,
      await params,
    );
    const query = parseQuery(req, attendeeListQuerySchema);
    const { items, meta } = await registrationService.listSessionAttendees(
      eventId,
      sessionId,
      query,
      currentUser,
    );
    return paginated(
      sessionAttendeeListResponseSchema.parse(items),
      sessionAttendeeListMetaSchema.parse(meta),
      { headers: PER_USER_HEADERS },
    );
  },
);
