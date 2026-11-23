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
  checkInListQuerySchema,
  checkInLogMetaSchema,
  checkInLogResponseSchema,
  checkInResponseSchema,
  eventCheckInBodySchema,
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
// permission and the organizer and the admin hold different ones. The body is the code and the
// event day it is for (`attendanceDate`, "2026-12-04"): the event is in the URL and who checks in
// is the login. A date that is not a day of the event is 409 NOT_AN_EVENT_DAY; that day's window
// (opens CHECK_IN_OPENS_HOURS_BEFORE before the day's start, closes when that day's hours end, the
// event's end on the last day) gives 409 CHECK_IN_NOT_OPEN / CHECK_IN_CLOSED. A code of another
// event or an unknown code is a 404, a cancelled ticket 409 REGISTRATION_CANCELLED, a repeat for
// the same day 409 ALREADY_CHECKED_IN (with who and since when in `details`).
export const POST = route<{ eventId: string }>(
  { auth: "signed-in", rateLimit: "user-write" },
  async ({ req, params, currentUser }) => {
    const { eventId } = parseInput(registrationEventParam, await params);
    const body = await parseBody(req, eventCheckInBodySchema);
    const checkIn = await registrationService.checkInAttendee(
      eventId,
      body,
      currentUser,
    );
    return created(checkInResponseSchema.parse(checkIn));
  },
);
