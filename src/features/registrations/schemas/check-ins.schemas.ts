import { z } from "zod";
import { checkInMethodEnum } from "../../../db/schemas";

//* POST /api/events/[eventId]/check-ins: the organizer (or admin) checks a person in at the door
// by typing the ticket code. The event comes from the URL and who checks in from the session, so
// the request carries the code (and, at the event door, the day): no user id, no method, no time.
export const checkInBodySchema = z.object({
  // Typed by hand, so spaces around it and lower case are forgiven.
  ticketCode: z
    .string("Ticket code is required")
    .trim()
    .min(1, "Ticket code is required")
    .max(32, "Ticket code is too long")
    .transform((code) => code.toUpperCase()),
});
export type CheckInBody = z.infer<typeof checkInBodySchema>;

// The event door's body: the code AND the event day the person is checked in for
// ("2026-12-04", in the event's time zone). The door screen picks the day that is running; the
// server only accepts a day of the event whose check-in window is open right now, so a past or a
// future day is refused. The session door does not send one: a session belongs to one day.
export const eventCheckInBodySchema = checkInBodySchema.extend({
  attendanceDate: z.iso.date("Attendance date must be a date (YYYY-MM-DD)"),
});
export type EventCheckInBody = z.infer<typeof eventCheckInBodySchema>;

// What the door needs to see after a successful check-in: who walked in. No email and no user id.
export const checkInResponseSchema = z.object({
  id: z.uuid(),
  registrationId: z.uuid(),
  // The event day in the event's time zone ("2026-12-12"): a two-day event has one per day.
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkedInAt: z.iso.datetime(),
  method: z.enum(checkInMethodEnum.enumValues),
  attendee: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    ticketCode: z.string().min(1),
  }),
});
export type CheckInDto = z.infer<typeof checkInResponseSchema>;

//* POST /api/events/[eventId]/sessions/[sessionId]/check-ins: the organizer (or admin) checks a
// booked person in at the door of ONE session by typing the ticket code. The event and the session
// come from the URL and who checks in from the login, so the request carries ONLY the code, the
// same body as the event check-in (`checkInBodySchema`): no user id, no method, no time.
// What the door needs to see after a successful check-in: who walked in. No email and no user id.
export const sessionCheckInResponseSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  checkedInAt: z.iso.datetime(),
  method: z.enum(checkInMethodEnum.enumValues),
  attendee: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    ticketCode: z.string().min(1),
  }),
});
export type SessionCheckInDto = z.infer<typeof sessionCheckInResponseSchema>;

// The `details` of a 409 ALREADY_CHECKED_IN from either door: who the ticket belongs to and when
// they were FIRST checked in (for that day, or for that session), so the door can say "Asha Rao
// is already checked in, since 09:41". No email and no user id, as in the success answer.
export const alreadyCheckedInDetailsSchema = z.object({
  attendee: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    ticketCode: z.string().min(1),
  }),
  checkedInAt: z.iso.datetime(),
});
export type AlreadyCheckedInDetails = z.infer<
  typeof alreadyCheckedInDetailsSchema
>;

//* GET /api/events/[eventId]/check-ins: the check-in LOG of one event, one page: one row per
// check-in, so a person on a two-day event appears once per day. For the organizer's Check-ins
// tab. Who may look is decided by the service (an organizer sees only their own events, an admin
// any event), exactly as for the attendee list.

// Newest check-in first (the default: the door's live feed), oldest first, or by name.
export const checkInSorts = ["newest", "oldest", "name"] as const;

export const checkInListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  // Matches the name, the email or the ticket code (contains, ignoring case).
  search: z.string().trim().max(100).optional(),
  // One event day, "2026-12-12" (in the event's time zone), for a multi-day event. Default: all days.
  date: z.iso.date("Date must be YYYY-MM-DD").optional(),
  sort: z.enum(checkInSorts).default("newest"),
});
export type CheckInListQuery = z.infer<typeof checkInListQuerySchema>;

// One line of the log: the person and the ticket, the event day and the exact time they were
// checked in (both: the day is in the event's time zone, so it cannot be read off the timestamp),
// the method and who did it (null once that user was deleted). No user id.
export const checkInLogItemSchema = z.object({
  id: z.uuid(),
  registrationId: z.uuid(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkedInAt: z.iso.datetime(),
  method: z.enum(checkInMethodEnum.enumValues),
  attendee: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().min(1),
    ticketCode: z.string().min(1),
  }),
  checkedInBy: z
    .object({ firstName: z.string().min(1), lastName: z.string().min(1) })
    .nullable(),
});
export type CheckInLogItemDto = z.infer<typeof checkInLogItemSchema>;

export const checkInLogResponseSchema = z.array(checkInLogItemSchema);

// For the "142 of 250 checked in" badge: the WHOLE event, whatever the search, day or paging.
// `checkedIn` counts people (a two-day event counts a person once), not check-ins.
export const checkInCountsSchema = z.object({
  checkedIn: z.number().int().min(0),
  registered: z.number().int().min(0),
});
export type CheckInCounts = z.infer<typeof checkInCountsSchema>;

export const checkInLogMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  counts: checkInCountsSchema,
});
export type CheckInLogMeta = z.infer<typeof checkInLogMetaSchema>;
