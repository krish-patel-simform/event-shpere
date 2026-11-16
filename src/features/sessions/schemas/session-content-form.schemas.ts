import { z } from "zod";
import {
  SESSION_CONTENT_LIMITS as LIMITS,
  type SessionContentDto,
  type UpdateSessionContentRequest,
} from "./session-content.schemas";

//* The content step's form. Every input is text; the limits are the server's
// (SESSION_CONTENT_LIMITS), with messages for the person filling the form.

const tooLong = (what: string, max: number) =>
  `${what} must be ${max.toLocaleString("en-IN")} characters or fewer`;

const isHttpsLink = (value: string) =>
  z.url({ protocol: /^https$/ }).safeParse(value).success;

export const sessionContentFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(LIMITS.description, tooLong("Description", LIMITS.description)),
  prerequisites: z
    .string()
    .trim()
    .max(LIMITS.prerequisites, tooLong("Prerequisites", LIMITS.prerequisites)),
  resources: z
    .array(
      z.object({
        label: z
          .string()
          .trim()
          .min(1, "Give the link a label")
          .max(LIMITS.resourceLabel, tooLong("Label", LIMITS.resourceLabel)),
        url: z
          .string()
          .trim()
          .max(LIMITS.resourceUrl, tooLong("Link", LIMITS.resourceUrl))
          .refine(isHttpsLink, "Use a link that starts with https://"),
      }),
    )
    .max(LIMITS.resources, `Add at most ${LIMITS.resources} links`),
});

export type SessionContentFormValues = z.infer<typeof sessionContentFormSchema>;

/** The saved content as the form's inputs: a text that was never written is "", not null. */
export function contentToFormValues(
  content: SessionContentDto,
): SessionContentFormValues {
  return {
    description: content.description,
    prerequisites: content.prerequisites ?? "",
    resources: content.resources,
  };
}

/**
 * The body of PATCH .../content. All the form's fields are sent: an empty text clears the saved
 * one (the server treats "" as "clear"), and the links replace the saved ones as a whole.
 */
export function toUpdateContentRequest(
  values: SessionContentFormValues,
): UpdateSessionContentRequest {
  return {
    description: values.description,
    prerequisites: values.prerequisites,
    resources: values.resources,
  };
}
