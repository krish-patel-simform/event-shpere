import { z } from "zod";
import type { ManagedEvent } from "../types/event-manage.types";
import { toFormDateTime } from "../utils/event-display";
import type { CreateEventRequest, UpdateEventRequest } from "./events.schemas";

// The form keeps every input as text (an empty number box is "", not NaN). These rules give
// messages for the person filling the form. Events are in India for now (like venues), so every
// time typed here is India Standard Time.

/** India has no daylight saving, so a fixed offset is exact. */
const IST_OFFSET = "+05:30";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** The moment a date ("2026-12-12") and a time ("09:30") typed in the form mean, in IST. */
export function istInstant(date: string, time: string): Date | null {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return null;
  const instant = new Date(`${date}T${time}:00${IST_OFFSET}`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

const dateField = (label: string) =>
  z.string().trim().regex(DATE_PATTERN, `${label} is required`);

const timeField = (label: string) =>
  z.string().trim().regex(TIME_PATTERN, `${label} is required`);

const eventFormFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title must be 255 characters or fewer"),
  // No slug here: the server makes the public link from the title and never takes it from the form.
  startDate: dateField("Start date"),
  startTime: timeField("Start time"),
  endDate: dateField("End date"),
  endTime: timeField("End time"),
  /** "" = no venue chosen yet (a draft can be saved without one). */
  venueId: z.string().trim(),
  /** "" = no limit. */
  capacity: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d+$/.test(value) && Number(value) > 0),
      "Capacity must be a whole number above 0",
    ),
  /** In rupees; 0 = free. */
  ticketPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 0 or 499.50"),
});

export type EventFormValues = z.infer<typeof eventFormFields>;

/**
 * The form's rules. `initial` is the start the event already has when it is edited: an event
 * that is already running keeps its start (in the past) while its other fields change, so the
 * "must start in the future" rule only applies to a start that was typed in.
 */
export function createEventFormSchema(
  initial?: Pick<EventFormValues, "startDate" | "startTime">,
) {
  return eventFormFields.superRefine((values, ctx) => {
    const start = istInstant(values.startDate, values.startTime);
    const end = istInstant(values.endDate, values.endTime);

    const startUnchanged =
      initial !== undefined &&
      values.startDate === initial.startDate &&
      values.startTime === initial.startTime;
    if (start && !startUnchanged && start.getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "The event must start in the future",
      });
    }
    if (start && end && end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The event must end after it starts",
      });
    }
  });
}

/** The rules for a new event: the start must be in the future. */
export const eventFormSchema = createEventFormSchema();

/** A new event: nine to five, no limit. The price is left empty; the input's placeholder shows 0. */
export const emptyEventForm: EventFormValues = {
  title: "",
  startDate: "",
  startTime: "09:00",
  endDate: "",
  endTime: "17:00",
  venueId: "",
  capacity: "",
  ticketPrice: "",
};

/** An existing event as the form's inputs: dates and times in the event's own zone. */
export function eventToFormValues(event: ManagedEvent): EventFormValues {
  const start = toFormDateTime(event.startAt, event.timezone);
  const end = toFormDateTime(event.endAt, event.timezone);

  return {
    title: event.title,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    venueId: event.venue?.id ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    ticketPrice: String(event.ticketPrice / 100),
  };
}

//* From the form's text to what the API takes

/** "2026-12-12" + "09:30" → "2026-12-12T09:30:00+05:30": ISO with the offset the API asks for. */
const toIsoWithOffset = (date: string, time: string) =>
  `${date}T${time}:00${IST_OFFSET}`;

/** Rupees as typed ("499.50") → paise (49950). Rounded, because 0.07 * 100 is 7.000000000000001. */
const rupeesToPaise = (rupees: string) => Math.round(Number(rupees) * 100);

/**
 * The body of POST /api/events. An empty venue or capacity is left out (not sent as ""), and the
 * time zone is India's: the server replaces it with the venue's when a venue is chosen.
 */
export function toCreateEventRequest(
  values: EventFormValues,
): CreateEventRequest {
  return {
    title: values.title,
    startAt: toIsoWithOffset(values.startDate, values.startTime),
    endAt: toIsoWithOffset(values.endDate, values.endTime),
    timezone: "Asia/Kolkata",
    ...(values.venueId ? { venueId: values.venueId } : {}),
    ...(values.capacity ? { capacity: Number(values.capacity) } : {}),
    ticketPrice: rupeesToPaise(values.ticketPrice),
  };
}

/**
 * The body of PATCH /api/events/[id]: every field the form edits. An empty venue or capacity
 * is sent as null, which clears it (leaving it out would leave the old one).
 */
export function toUpdateEventRequest(
  values: EventFormValues,
): UpdateEventRequest {
  return {
    title: values.title,
    startAt: toIsoWithOffset(values.startDate, values.startTime),
    endAt: toIsoWithOffset(values.endDate, values.endTime),
    venueId: values.venueId || null,
    capacity: values.capacity ? Number(values.capacity) : null,
    ticketPrice: rupeesToPaise(values.ticketPrice),
  };
}
