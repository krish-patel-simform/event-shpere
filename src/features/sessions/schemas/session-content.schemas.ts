import { z } from "zod";
import { cmsMediaSchema } from "../../cms";

//* PATCH /api/events/[eventId]/sessions/[sessionId]/content: the descriptive half of a session
// (stored in Strapi). The description is sent as plain text (blank line = new paragraph) and
// stored as blocks. Only the fields that are sent change; `null` or "" clears a text.
// `resources` is replaced as a whole. The cover image has its own route.
// The limits live in one place: the content form uses the same numbers as the server.
export const SESSION_CONTENT_LIMITS = {
  description: 10_000,
  prerequisites: 1_000,
  resources: 10,
  resourceLabel: 100,
  resourceUrl: 2_048,
} as const;

const resourceSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(SESSION_CONTENT_LIMITS.resourceLabel),
  // https only, like the join link: it is shown as a link on the public page.
  url: z
    .url({
      protocol: /^https$/,
      error: "Use a link that starts with https://",
    })
    .max(SESSION_CONTENT_LIMITS.resourceUrl),
});

export const updateSessionContentBodySchema = z
  .object({
    description: z
      .string()
      .trim()
      .max(SESSION_CONTENT_LIMITS.description)
      .nullable()
      .optional(),
    prerequisites: z
      .string()
      .trim()
      .max(SESSION_CONTENT_LIMITS.prerequisites)
      .nullable()
      .optional(),
    resources: z
      .array(resourceSchema)
      .max(SESSION_CONTENT_LIMITS.resources)
      .optional(),
  })
  // Unknown keys are dropped by Zod, so a body with only unknown keys ends up empty here.
  .refine(
    (body) => Object.keys(body).length > 0,
    "Send at least one field to change",
  );

export type UpdateSessionContentBody = z.infer<
  typeof updateSessionContentBodySchema
>;
/** What the browser sends. */
export type UpdateSessionContentRequest = z.input<
  typeof updateSessionContentBodySchema
>;

//* What the edit form shows: the description as plain text, empty things as "" / [] / null.
export const sessionContentResponseSchema = z.object({
  description: z.string(),
  prerequisites: z.string().nullable(),
  resources: z.array(z.object({ label: z.string(), url: z.string() })),
  coverImage: cmsMediaSchema.nullable(),
});
export type SessionContentDto = z.infer<typeof sessionContentResponseSchema>;

//* POST and DELETE /api/events/[eventId]/sessions/[sessionId]/cover: the cover image alone.
export const sessionCoverResponseSchema = z.object({
  coverImage: cmsMediaSchema.nullable(),
});
export type SessionCoverDto = z.infer<typeof sessionCoverResponseSchema>;
