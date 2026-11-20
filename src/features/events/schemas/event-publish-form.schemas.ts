import { z } from "zod";
import { eventDateLimits } from "../utils/event-date-limits";
import {
  dateField,
  istInstant,
  timeField,
  toIsoWithOffset,
} from "./event-form.schemas";
import type { PublishEventRequest } from "./events.schemas";

// The publish dialog's inputs, kept as text like every form here. Registration dates are typed in
// India Standard Time (events are in India for now). These rules give the organizer a message
// next to the field; the server checks the same rules and has the final say.

const publishFormFields = z.object({
  opensDate: dateField("Registration start date"),
  opensTime: timeField("Registration start time"),
  closesDate: dateField("Registration end date"),
  closesTime: timeField("Registration end time"),
});

export type PublishFormValues = z.infer<typeof publishFormFields>;

export const emptyPublishFormValues: PublishFormValues = {
  opensDate: "",
  opensTime: "",
  closesDate: "",
  closesTime: "",
};

/**
 * Registration opens today or later and closes in the future, and both are before the event
 * starts (`eventStartAt`, an ISO string). The closing time must also be after the opening time.
 */
export function createPublishFormSchema(eventStartAt: string) {
  const start = new Date(eventStartAt);

  return publishFormFields.superRefine((values, ctx) => {
    const now = new Date();
    const today = eventDateLimits(now).min;
    const opens = istInstant(values.opensDate, values.opensTime);
    const closes = istInstant(values.closesDate, values.closesTime);
    const issue = (path: "opensDate" | "closesDate", message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    // A date that is still empty already has its own "is required" message.
    if (opens) {
      if (values.opensDate < today) {
        issue("opensDate", "Registration can't start before today");
      } else if (opens >= start) {
        issue("opensDate", "Registration must start before the event starts");
      }
    }
    if (closes) {
      if (closes >= start) {
        issue("closesDate", "Registration must end before the event starts");
      } else if (closes <= now) {
        issue("closesDate", "Registration must end in the future");
      } else if (opens && closes <= opens) {
        issue("closesDate", "Registration must end after it starts");
      }
    }
  });
}

/** The body of POST /api/events/[eventId]/publish: ISO strings with the IST offset. */
export function toPublishEventRequest(
  values: PublishFormValues,
): PublishEventRequest {
  return {
    registrationOpensAt: toIsoWithOffset(values.opensDate, values.opensTime),
    registrationClosesAt: toIsoWithOffset(values.closesDate, values.closesTime),
  };
}
