import { z } from "zod";

//* GET /api/venues/[venueId]/halls/availability?startAt=...&endAt=...
// The venue's active halls and when each is taken inside the asked time range. The create-event
// form asks it once the venue and the dates are chosen, to show which halls are free.
// A session holds its hall while it is not cancelled and has a time (draft or scheduled),
// whichever event it belongs to.

/** The longest range one request may ask about, so a call cannot scan years of bookings. */
export const HALL_AVAILABILITY_MAX_DAYS = 31;
const DAY_MS = 86_400_000;

// An ISO string with an offset, turned into a Date: "2026-12-12T09:00:00+05:30".
const isoDate = z.iso
  .datetime({ offset: true, error: "Use an ISO date with a time zone offset" })
  .transform((value) => new Date(value));

export const hallAvailabilityQuerySchema = z
  .object({
    startAt: isoDate,
    endAt: isoDate,
  })
  .superRefine((query, ctx) => {
    // Zod still runs this when a date failed to parse (the field then holds the raw text), and
    // the field's own error is already reported: skip, or a bad date would throw here (a 500).
    if (!(query.startAt instanceof Date) || !(query.endAt instanceof Date)) {
      return;
    }
    if (query.endAt <= query.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "End must be after the start",
      });
    } else if (
      query.endAt.getTime() - query.startAt.getTime() >
      HALL_AVAILABILITY_MAX_DAYS * DAY_MS
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: `Ask about at most ${HALL_AVAILABILITY_MAX_DAYS} days at a time`,
      });
    }
  });

export type HallAvailabilityQuery = z.infer<typeof hallAvailabilityQuerySchema>;
/** What the browser sends: the dates are still ISO strings. */
export type HallAvailabilityRequest = z.input<
  typeof hallAvailabilityQuerySchema
>;

/** A time the hall is taken. Only the time: never what the session is or whose it is. */
export const bookedSlotSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
});

export const hallAvailabilitySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  capacity: z.number().int(),
  /**
   * true when ANY session holds the hall during the asked range, even only a part of it. It
   * answers "is this hall completely free?". For a hall that is only partly taken,
   * `bookedSlots` tells which times are gone.
   */
  busy: z.boolean(),
  /** The times inside the asked range that are taken, earliest first. Empty = completely free. */
  bookedSlots: z.array(bookedSlotSchema),
});
export type HallAvailabilityDto = z.infer<typeof hallAvailabilitySchema>;

// A venue always has halls, but one may have none that are switched on: an empty list.
export const hallAvailabilityResponseSchema = z.array(hallAvailabilitySchema);
