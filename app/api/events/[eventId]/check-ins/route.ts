import {
  created,
  paginated,
  parseBody,
  parseInput,
  parseQuery,
  PER_USER_HEADERS,
  route,
} from "@/src/core/http";
import {
  checkInBodySchema,
  checkInListQuerySchema,
  checkInLogMetaSchema,
  checkInLogResponseSchema,
  checkInResponseSchema,
  registrationEventParam,
} from "@/src/features/registrations";
import { registrationService } from "@/src/features/registrations/server";

// The check-in LOG of ONE event, one page, for the organizer's Check-ins tab: one row per check-in
// (a person on a two-day event appears once per day), newest first unless `sort` says oldest or
// name, searched by name, email or ticket code, optionally for one event `date`. REGISTRATION_VIEW_EVENT
// reaches only the organizer's own events (someone else's is a 404, never a 403),
// REGISTRATION_VIEW_ALL any event; the service decides, not the route, because a route's
// `permission` list needs every permission and the organizer and the admin hold different ones.
// `meta.counts` is how many people checked in out of how many registered, for the whole event. It
// carries names and emails, so no cache may keep it.
export const GET = route<{ eventId: string }>(
  { auth: "signed-in", rateLimit: "user-read" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const query = parseQuery(req, checkInListQuerySchema);
    const { items, meta } = await registrationService.listCheckIns(
      eventId,
      query,
      currentUser,
    );
    return paginated(
      checkInLogResponseSchema.parse(items),
      checkInLogMetaSchema.parse(meta),
      { headers: PER_USER_HEADERS },
    );
  },
);

// Checks a person in at the door by typing their ticket code. REGISTRATION_CHECKIN_EVENT reaches
// only the organizer's own events (someone else's is a 404, never a 403), REGISTRATION_CHECKIN_ALL
// any event; the service decides, not the route, because a route's `permission` list needs every
// permission and the organizer and the admin hold different ones. The body is ONLY the code: the
// event is in the URL and who checks in is the login. A code of another event or an unknown code
// is a 404, a cancelled ticket 409 REGISTRATION_CANCELLED, a repeat on the same day 409
// ALREADY_CHECKED_IN, and outside the window (6 hours before the start until the end) 409
// CHECK_IN_NOT_OPEN / CHECK_IN_CLOSED.
export const POST = route<{ eventId: string }>(
  { auth: "signed-in", rateLimit: "user-write" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const body = await parseBody(req, checkInBodySchema);
    const checkIn = await registrationService.checkInAttendee(
      eventId,
      body,
      currentUser,
    );
    return created(checkInResponseSchema.parse(checkIn));
  },
);
