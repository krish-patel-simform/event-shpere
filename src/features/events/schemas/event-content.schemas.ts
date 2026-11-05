import { z } from "zod";
import { cmsMediaSchema } from "../../cms";

// A uuid, not just a string: a malformed id would otherwise reach Postgres and become a 500.
export const eventIdParam = z.object({
  eventId: z.uuid("Event id must be a valid id"),
});

// fileId is the Strapi upload id (a number): it is checked against the event's own gallery.
export const galleryImageParam = eventIdParam.extend({
  fileId: z.coerce
    .number()
    .int("Image id must be a whole number")
    .positive("Image id must be above 0"),
});

//* PATCH /api/events/[eventId]/content: the descriptive half of an event (stored in Strapi).
// Rich text is sent as plain text (blank line = new paragraph) and stored as blocks. Only the
// fields that are sent change; `null` or "" clears a text. highlights, faqs and seo are
// replaced as a whole. The images have their own routes (cover, gallery).
// The limits live in one place: the content step's form uses the same numbers as the server.
export const EVENT_CONTENT_LIMITS = {
  tagline: 160,
  about: 10_000,
  venueGuide: 5_000,
  highlights: 8,
  highlightTitle: 100,
  highlightDescription: 300,
  faqs: 20,
  question: 200,
  answer: 2_000,
  metaTitle: 70,
  metaDescription: 160,
} as const;

const highlightSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(EVENT_CONTENT_LIMITS.highlightTitle),
  description: z
    .string()
    .trim()
    .max(EVENT_CONTENT_LIMITS.highlightDescription)
    .default(""),
});

const faqSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(EVENT_CONTENT_LIMITS.question),
  answer: z
    .string()
    .trim()
    .min(1, "Answer is required")
    .max(EVENT_CONTENT_LIMITS.answer),
});

export const updateEventContentBodySchema = z
  .object({
    tagline: z
      .string()
      .trim()
      .max(EVENT_CONTENT_LIMITS.tagline)
      .nullable()
      .optional(),
    about: z
      .string()
      .trim()
      .max(EVENT_CONTENT_LIMITS.about)
      .nullable()
      .optional(),
    venueGuide: z
      .string()
      .trim()
      .max(EVENT_CONTENT_LIMITS.venueGuide)
      .nullable()
      .optional(),
    highlights: z
      .array(highlightSchema)
      .max(EVENT_CONTENT_LIMITS.highlights)
      .optional(),
    faqs: z.array(faqSchema).max(EVENT_CONTENT_LIMITS.faqs).optional(),
    seo: z
      .object({
        metaTitle: z
          .string()
          .trim()
          .max(EVENT_CONTENT_LIMITS.metaTitle)
          .optional(),
        metaDescription: z
          .string()
          .trim()
          .max(EVENT_CONTENT_LIMITS.metaDescription)
          .optional(),
      })
      .nullable()
      .optional(),
  })
  // Unknown keys are dropped by Zod, so a body with only unknown keys ends up empty here.
  .refine(
    (body) => Object.keys(body).length > 0,
    "Send at least one field to change",
  );

export type UpdateEventContentBody = z.infer<
  typeof updateEventContentBodySchema
>;

//* Responses

// One image: the same shape for every feature's responses (cms owns it). `id` is the Strapi
// upload id, which DELETE .../gallery/[fileId] takes.
export const eventMediaSchema = cmsMediaSchema;
export type EventMediaDto = z.infer<typeof eventMediaSchema>;

// What the edit form shows: rich texts as plain text, empty things as "" / [] / null.
export const eventContentResponseSchema = z.object({
  tagline: z.string().nullable(),
  about: z.string(),
  venueGuide: z.string(),
  highlights: z.array(z.object({ title: z.string(), description: z.string() })),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  seo: z.object({
    metaTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
  }),
  coverImage: eventMediaSchema.nullable(),
  gallery: z.array(eventMediaSchema),
});
export type EventContentDto = z.infer<typeof eventContentResponseSchema>;

export const eventCoverResponseSchema = z.object({
  coverImage: eventMediaSchema.nullable(),
});
export type EventCoverDto = z.infer<typeof eventCoverResponseSchema>;

export const eventGalleryResponseSchema = z.object({
  gallery: z.array(eventMediaSchema),
});
export type EventGalleryDto = z.infer<typeof eventGalleryResponseSchema>;
