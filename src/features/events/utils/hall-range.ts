import {
  hallAvailabilityQuerySchema,
  type HallAvailabilityRequest,
} from "@/src/features/venues";
import {
  toIsoWithOffset,
  type EventFormValues,
} from "../schemas/event-form.schemas";

/**
 * The time range of the event as the form has it now, to ask which halls of the venue are free;
 * null until the four date and time inputs make a range the server would accept (all filled in,
 * the end after the start, and not longer than it allows). The check is the venue API's own query
 * schema, so the form never sends a range the server would refuse.
 */
export function toHallAvailabilityRange(
  values: Pick<
    EventFormValues,
    "startDate" | "startTime" | "endDate" | "endTime"
  >,
): HallAvailabilityRequest | null {
  const { startDate, startTime, endDate, endTime } = values;
  if (!startDate || !startTime || !endDate || !endTime) return null;

  const range = {
    startAt: toIsoWithOffset(startDate, startTime),
    endAt: toIsoWithOffset(endDate, endTime),
  };
  return hallAvailabilityQuerySchema.safeParse(range).success ? range : null;
}
