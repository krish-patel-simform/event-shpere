import { z } from "zod";
import {
  EVENT_CONTENT_LIMITS as LIMITS,
  type EventContentDto,
  type UpdateEventContentBody,
} from "./event-content.schemas";

//* The content step's form. Every input is text; the limits are the server's
// (EVENT_CONTENT_LIMITS), with messages for the person filling the form.

const tooLong = (what: string, max: number) =>
  `${what} must be ${max.toLocaleString("en-IN")} characters or fewer`;

export const eventContentFormSchema = z.object({
  tagline: z
    .string()
    .trim()
    .max(LIMITS.tagline, tooLong("Tagline", LIMITS.tagline)),
  about: z.string().trim().max(LIMITS.about, tooLong("About", LIMITS.about)),
  venueGuide: z
    .string()
    .trim()
    .max(LIMITS.venueGuide, tooLong("Venue guide", LIMITS.venueGuide)),
  highlights: z
    .array(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, "Give the highlight a title")
          .max(LIMITS.highlightTitle, tooLong("Title", LIMITS.highlightTitle)),
        description: z
          .string()
          .trim()
          .max(
            LIMITS.highlightDescription,
            tooLong("Description", LIMITS.highlightDescription),
          ),
      }),
    )
    .max(LIMITS.highlights, `Add at most ${LIMITS.highlights} highlights`),
  faqs: z
    .array(
      z.object({
        question: z
          .string()
          .trim()
          .min(1, "Write the question")
          .max(LIMITS.question, tooLong("Question", LIMITS.question)),
        answer: z
          .string()
          .trim()
          .min(1, "Write the answer")
          .max(LIMITS.answer, tooLong("Answer", LIMITS.answer)),
      }),
    )
    .max(LIMITS.faqs, `Add at most ${LIMITS.faqs} questions`),
  seo: z.object({
    metaTitle: z
      .string()
      .trim()
      .max(LIMITS.metaTitle, tooLong("Meta title", LIMITS.metaTitle)),
    metaDescription: z
      .string()
      .trim()
      .max(
        LIMITS.metaDescription,
        tooLong("Meta description", LIMITS.metaDescription),
      ),
  }),
});

export type EventContentFormValues = z.infer<typeof eventContentFormSchema>;

/** The saved content as the form's inputs: a text that was never written is "", not null. */
export function contentToFormValues(
  content: EventContentDto,
): EventContentFormValues {
  return {
    tagline: content.tagline ?? "",
    about: content.about,
    venueGuide: content.venueGuide,
    highlights: content.highlights,
    faqs: content.faqs,
    seo: {
      metaTitle: content.seo.metaTitle ?? "",
      metaDescription: content.seo.metaDescription ?? "",
    },
  };
}

/**
 * The body of PATCH .../content. All the form's fields are sent: an empty text clears the saved
 * one (the server treats "" as "clear"), and the lists replace the saved ones as a whole.
 */
export function toUpdateContentRequest(
  values: EventContentFormValues,
): UpdateEventContentBody {
  return {
    tagline: values.tagline,
    about: values.about,
    venueGuide: values.venueGuide,
    highlights: values.highlights,
    faqs: values.faqs,
    seo: values.seo,
  };
}
