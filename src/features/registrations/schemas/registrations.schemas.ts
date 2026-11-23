import { z } from "zod";
import { eventStatusEnum, registrationStatusEnum } from "../../../db/schemas";

// A uuid, not just a string: a malformed id would otherwise reach Postgres and become a 500.
// Kept local: a feature must not import another feature's schemas.
export const registrationEventParam = z.object({
  eventId: z.uuid("Event id must be a valid id"),
});

// Why the ticket costs what it costs. "paid" joins this list when Stripe is added.
export const registrationReasonSchema = z.enum([
  "free",
  "complimentary_speaker",
]);
export type RegistrationReason = z.infer<typeof registrationReasonSchema>;

//* POST /api/events/[eventId]/registrations: the signed-in user registers for the event.
// There is NO request body: the event comes from the URL and the user from the session, so the
// client can never register somebody else. No userId, status, ticketCode or price in the request.
// The response is the user's own ticket, so the ticket code is safe to send.
export const registrationResponseSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  // Taken from the table's enum, so a status added later (pending_payment) is accepted for free.
  status: z.enum(registrationStatusEnum.enumValues),
  ticketCode: z.string().min(1),
  // Paise: 150000 = ₹1,500. 0 until paid tickets exist.
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  reason: registrationReasonSchema,
  registeredAt: z.iso.datetime(),
});
export type RegistrationDto = z.infer<typeof registrationResponseSchema>;

//* GET /api/events/[eventId]/registrations/me: the signed-in user's own standing in ONE event.
// `registration` is null when they never registered (a normal answer, not a 404), and a
// cancelled one comes back with status "cancelled" so the page can offer "register again".
// `bookedSessionIds` are the sessions of this event they hold a seat in, so the event page and
// every session page of the event need only this one request.
export const myRegistrationResponseSchema = z.object({
  registration: registrationResponseSchema.nullable(),
  bookedSessionIds: z.array(z.uuid()),
});
export type MyRegistrationDto = z.infer<typeof myRegistrationResponseSchema>;

//* GET /api/me/registrations: every event the signed-in user registered for, one page ("My tickets").
// No user id anywhere: whose tickets these are comes from the login.

// Which tickets: by the registration's status. Cancelled ones are included by default so a
// cancelled ticket stays visible, with "register again" on the page.
export const myRegistrationStatusFilters = [
  "all",
  "registered",
  "cancelled",
] as const;

// Which events: by when the EVENT ends, not by the registration.
export const myRegistrationWhenFilters = ["upcoming", "past", "all"] as const;

export const myRegistrationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(myRegistrationStatusFilters).default("all"),
  // "upcoming" lists the soonest event first; "past" and "all" the most recent first.
  when: z.enum(myRegistrationWhenFilters).default("upcoming"),
});
export type MyRegistrationListQuery = z.infer<
  typeof myRegistrationListQuerySchema
>;

// The event half of a ticket card, from Postgres only: the cover image lives in the CMS, so the
// page asks the event routes for it. `status` is the EVENT's, so a cancelled event can say so.
export const myTicketEventSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(eventStatusEnum.enumValues),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  timezone: z.string().min(1),
  /** Cancelling stops here, or at `startAt` when null (the same rule as route 3). */
  registrationClosesAt: z.iso.datetime().nullable(),
  venueName: z.string().nullable(),
  venueCity: z.string().nullable(),
});

export const myTicketSchema = z.object({
  registration: registrationResponseSchema,
  event: myTicketEventSchema,
  // Sessions of this event the user holds a seat in (0 once the registration is cancelled).
  bookedSessionCount: z.number().int().min(0),
});
export type MyTicketDto = z.infer<typeof myTicketSchema>;

export const myTicketListResponseSchema = z.array(myTicketSchema);

// Both ids are uuids, not just strings: a malformed id would otherwise reach Postgres and become a 500.
export const sessionBookingParam = z.object({
  eventId: z.uuid("Event id must be a valid id"),
  sessionId: z.uuid("Session id must be a valid id"),
});

//* POST /api/events/[eventId]/sessions/[sessionId]/registrations: the signed-in user books a seat.
// There is NO request body: the event and session come from the URL and the user from the
// session, so the client can never book a seat for somebody else.
// The response is the user's own booking: no user id, no `cancelledAt`.
export const sessionBookingResponseSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  // Taken from the table's enum, like the event registration.
  status: z.enum(registrationStatusEnum.enumValues),
  registeredAt: z.iso.datetime(),
});
export type SessionBookingDto = z.infer<typeof sessionBookingResponseSchema>;
