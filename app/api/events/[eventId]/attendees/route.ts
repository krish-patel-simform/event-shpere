import {
  paginated,
  parseInput,
  parseQuery,
  PER_USER_HEADERS,
  route,
} from "@/src/core/http";
import {
  attendeeListMetaSchema,
  attendeeListQuerySchema,
  attendeeListResponseSchema,
  registrationEventParam,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// Who registered for ONE event, one page, for the organizer's Attendees tab: searched by name,
// email or ticket code, filtered by status and by checked-in, sorted newest (default), oldest or
// by name. REGISTRATION_VIEW_EVENT reaches
// only the organizer's own events (someone else's is a 404, never a 403), REGISTRATION_VIEW_ALL
// any event. The service decides, not the route, because a route's `permission` list needs every
// permission and the organizer and the admin hold different ones. It carries names, emails and
// ticket codes, so no cache may keep it.
export const GET = route<{ eventId: string }>(
  { auth: "signed-in", rateLimit: "user-read" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const query = parseQuery(req, attendeeListQuerySchema);
    const { items, meta } = await registrationService.listAttendees(
      eventId,
      query,
      currentUser,
    );
    return paginated(
      attendeeListResponseSchema.parse(items),
      attendeeListMetaSchema.parse(meta),
      { headers: PER_USER_HEADERS },
    );
  },
);
