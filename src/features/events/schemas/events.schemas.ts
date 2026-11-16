import { z } from "zod";
import { eventStatusEnum } from "../../../db/schemas";

// IANA zone names only (e.g. Asia/Kolkata). Kept local: a feature must not import another
// feature's schemas, and the events table has its own timezone column.
const timezoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone (use an IANA name like Asia/Kolkata)");

// An ISO string with an offset, turned into a Date: "2026-12-01T10:00:00+05:30".
// A datetime-local input has NO zone, so the form must add the offset before sending.
const isoDate = z.iso
  .datetime({ offset: true, error: "Use an ISO date with a time zone offset" })
  .transform((value) => new Date(value));

//* POST /api/events: an organizer creates an event. It is ALWAYS saved as a draft.
// No id, organizerId, status, slug, publishedAt or cmsEventId here: the server sets them,
// never the client.
export const createEventBodySchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(255),
    startAt: isoDate,
    endAt: isoDate,
    // Ignored when a venue is chosen (the venue's zone is copied); used for a draft without one.
    timezone: timezoneSchema.optional(),
    venueId: z.uuid("Venue id must be a valid id").optional(),
    // Omitted = no limit. The events table has check (capacity > 0).
    capacity: z
      .number()
      .int("Capacity must be a whole number")
      .positive("Capacity must be above 0")
      .optional(),
    // Paise: 150000 = ₹1,500. 0 = free.
    ticketPrice: z.number().int().min(0, "Price cannot be negative").default(0),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code")
      .default("INR"),
    registrationOpensAt: isoDate.optional(),
    registrationClosesAt: isoDate.optional(),
  })
  .superRefine((body, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (body.startAt <= new Date()) {
      issue("startAt", "Start must be in the future");
    }
    if (body.endAt <= body.startAt) {
      issue("endAt", "End must be after the start");
    }

    const { registrationOpensAt: opens, registrationClosesAt: closes } = body;
    if (opens && closes && closes <= opens) {
      issue("registrationClosesAt", "Registration must close after it opens");
    }
    // The table says "null = closes when the event starts", so a later close contradicts it.
    if (closes && closes > body.startAt) {
      issue(
        "registrationClosesAt",
        "Registration must close before the event starts",
      );
    }
  });

export type CreateEventBody = z.infer<typeof createEventBodySchema>;
/** What the browser sends: dates are still ISO strings (the schema turns them into Dates). */
export type CreateEventRequest = z.input<typeof createEventBodySchema>;

//* PATCH /api/events/[eventId]: an organizer changes an event's details. Only the fields that
// are sent change, and `null` clears the venue or the capacity. No status, slug or owner here,
// and the slug never changes (links have been shared). Whether a change is allowed depends on
// the event (registrations, sessions, status), so the service decides, not this schema.
export const updateEventBodySchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(255).optional(),
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    venueId: z.uuid("Venue id must be a valid id").nullable().optional(),
    capacity: z
      .number()
      .int("Capacity must be a whole number")
      .positive("Capacity must be above 0")
      .nullable()
      .optional(),
    ticketPrice: z.number().int().min(0, "Price cannot be negative").optional(),
  })
  // Unknown keys are dropped by Zod, so a body with only unknown keys ends up empty here.
  .refine(
    (body) => Object.keys(body).length > 0,
    "Send at least one field to change",
  )
  .superRefine((body, ctx) => {
    // Both dates sent: they must agree. One date sent: the service checks it against the other
    // one it already has.
    if (body.startAt && body.endAt && body.endAt <= body.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "End must be after the start",
      });
    }
  });

export type UpdateEventBody = z.infer<typeof updateEventBodySchema>;
export type UpdateEventRequest = z.input<typeof updateEventBodySchema>;

// What the API returns. The DTO picks these fields one by one: organizerId and cmsEventId
// stay internal.
export const eventResponseSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(eventStatusEnum.enumValues),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  timezone: z.string(),
  venueId: z.uuid().nullable(),
  capacity: z.number().int().nullable(),
  ticketPrice: z.number().int(),
  currency: z.string(),
  registrationOpensAt: z.iso.datetime().nullable(),
  registrationClosesAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type EventDto = z.infer<typeof eventResponseSchema>;
