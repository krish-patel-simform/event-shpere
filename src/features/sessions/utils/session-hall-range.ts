import {
  hallAvailabilityQuerySchema,
  type HallAvailabilityRequest,
} from "../../venues";
import { toIsoWithOffset } from "../../events";
import type { SessionFormValues } from "../schemas/session-form.schemas";

/**
 * The slot of the session as the form has it now, to ask which halls are available for it; null
 * until the date and both times make a range the server would accept (all filled in, the end
 * after the start). The check is the venue API's own query schema, so the form never sends a
 * range the server would refuse.
 */
export function toSessionHallRange(
  values: Pick<SessionFormValues, "date" | "startTime" | "endTime">,
): HallAvailabilityRequest | null {
  const { date, startTime, endTime } = values;
  if (!date || !startTime || !endTime) return null;

  const range = {
    startAt: toIsoWithOffset(date, startTime),
    endAt: toIsoWithOffset(date, endTime),
  };
  return hallAvailabilityQuerySchema.safeParse(range).success ? range : null;
}
