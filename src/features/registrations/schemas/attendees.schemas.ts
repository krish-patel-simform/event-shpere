import { z } from "zod";
import { checkInMethodEnum, registrationStatusEnum } from "../../../db/schemas";

//* GET /api/events/[eventId]/attendees: the organizer's (or admin's) list of who registered for
// one event, one page. The event comes from the URL; who may look is decided by the service
// (an organizer sees only their own events, an admin any event).

export const attendeeStatusFilters = [
  "all",
  "registered",
  "cancelled",
] as const;
export const attendeeCheckInFilters = ["all", "yes", "no"] as const;
// Newest or oldest registration first, by name (last name, then first name), or the person who
// checked in last first (the door's live feed; people who have not checked in come last).
export const attendeeSorts = ["newest", "oldest", "name", "checkedIn"] as const;

export const attendeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(attendeeStatusFilters).default("all"),
  // Has the person checked in? Without `date`: on any day of the event.
  checkedIn: z.enum(attendeeCheckInFilters).default("all"),
  // One event day, "2026-12-12" (in the event's time zone), for a multi-day event. With it,
  // `checkedIn`, `checkedInAt`, `checkedInBy` and the counts all mean THAT day, so "pending on
  // day 2" is registered people with no check-in on day 2. Ignored by a session's list (a session
  // happens once). Default: any day.
  date: z.iso.date("Date must be YYYY-MM-DD").optional(),
  sort: z.enum(attendeeSorts).default("newest"),
  // Matches the name, the email or the ticket code (contains, ignoring case).
  search: z.string().trim().max(100).optional(),
});
export type AttendeeListQuery = z.infer<typeof attendeeListQuerySchema>;

// One attendee: just what the door and the Attendees tab need. No user id and no password, token
// or phone: the registration id is enough to point at a row.
export const attendeeSchema = z.object({
  registrationId: z.uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().min(1),
  ticketCode: z.string().min(1),
  status: z.enum(registrationStatusEnum.enumValues),
  registeredAt: z.iso.datetime(),
  // The latest check-in, or the one of the asked `date` (a multi-day event has one per day);
  // null = not checked in.
  checkedInAt: z.iso.datetime().nullable(),
  // Who checked them in, by name only (null: not checked in, or no staff member recorded), and how.
  checkedInBy: z
    .object({ firstName: z.string().min(1), lastName: z.string().min(1) })
    .nullable(),
  checkInMethod: z.enum(checkInMethodEnum.enumValues).nullable(),
});
export type AttendeeDto = z.infer<typeof attendeeSchema>;

export const attendeeListResponseSchema = z.array(attendeeSchema);

// How many attendees each tab holds for the WHOLE event, whatever the search or the filters,
// so the badges do not change while the organizer types. Checked-in counts registered people only,
// and `pending` is registered people who have not checked in. With `date` both mean that day.
export const attendeeCountsSchema = z.object({
  registered: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  checkedIn: z.number().int().min(0),
  pending: z.number().int().min(0),
});
export type AttendeeCounts = z.infer<typeof attendeeCountsSchema>;

export const attendeeListMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  counts: attendeeCountsSchema,
});
export type AttendeeListMeta = z.infer<typeof attendeeListMetaSchema>;

//* GET /api/events/[eventId]/sessions/[sessionId]/attendees: who holds a seat in ONE session, one
// page, with whether they checked in to it. The query is the event attendee list's
// (`attendeeListQuerySchema`): page, pageSize, status of the seat, checkedIn (yes / no = pending),
// sort and search. A seat is checked in at most once, so this one list is both "who booked" and
// "who checked in".

// One seat: the person, their event ticket code (the door types it to check them in) and the
// session check-in. No user id: the booking id is enough to point at a row.
export const sessionAttendeeSchema = z.object({
  bookingId: z.uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().min(1),
  ticketCode: z.string().min(1),
  status: z.enum(registrationStatusEnum.enumValues),
  bookedAt: z.iso.datetime(),
  // When the person was checked in to this session; null = not yet.
  checkedInAt: z.iso.datetime().nullable(),
});
export type SessionAttendeeDto = z.infer<typeof sessionAttendeeSchema>;

export const sessionAttendeeListResponseSchema = z.array(sessionAttendeeSchema);

// The badges for the WHOLE session, whatever the search or the filters. `checkedIn` counts the
// check-ins themselves, so a session cancelled half-way (which cancels every seat) keeps its
// attendance; `pending` is registered seats nobody has checked in yet.
export const sessionAttendeeCountsSchema = z.object({
  registered: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  checkedIn: z.number().int().min(0),
  pending: z.number().int().min(0),
});
export type SessionAttendeeCounts = z.infer<typeof sessionAttendeeCountsSchema>;

export const sessionAttendeeListMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  counts: sessionAttendeeCountsSchema,
});
export type SessionAttendeeListMeta = z.infer<
  typeof sessionAttendeeListMetaSchema
>;
