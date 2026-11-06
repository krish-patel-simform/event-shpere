import { z } from "zod";
import {
  publicEventSlugParam,
  publicMediaSchema,
  publicSessionSchema,
} from "../../events";

//* GET /api/events/slug/[slug]/sessions/[sessionId]: one session's public page. Open to anyone.
// The session must be scheduled and its event published (or cancelled, which stays visible); a
// draft event, a cancelled or draft session, or a session of another event is a 404. Nothing
// here comes from the organizer's views: no join link, no status, no booking figures, no Strapi
// file ids.

export const publicSessionParams = z.object({
  slug: publicEventSlugParam.shape.slug,
  sessionId: z.uuid("Session id must be a valid id"),
});

/** The written part of the session (Strapi), as the public sees it. */
export const publicSessionContentSchema = z.object({
  /** Plain text: a blank line starts a new paragraph. "" when the organizer wrote none. */
  description: z.string(),
  prerequisites: z.string().nullable(),
  /** Links with an https URL only. */
  resources: z.array(z.object({ label: z.string(), url: z.string() })),
  coverImage: publicMediaSchema.nullable(),
});
export type PublicSessionContentDto = z.infer<
  typeof publicSessionContentSchema
>;

export const publicSessionDetailSchema = publicSessionSchema.extend({
  /** The event the session belongs to, for the breadcrumb, the back link and the time zone. */
  event: z.object({
    slug: z.string(),
    title: z.string(),
    /** A cancelled event stays visible: its sessions show a cancelled banner. */
    status: z.enum(["published", "cancelled"]),
    /** IANA zone the times are shown in (the venue's). */
    timezone: z.string(),
  }),
  /** null = the CMS did not answer: the page still shows the facts above. */
  content: publicSessionContentSchema.nullable(),
});
export type PublicSessionDetailDto = z.infer<typeof publicSessionDetailSchema>;
