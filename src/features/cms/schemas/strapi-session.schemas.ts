import { z } from "zod";
import {
  strapiBlocksSchema,
  strapiMediaSchema,
  type CmsMedia,
  type StrapiBlocks,
} from "./strapi-common.schemas";

//* POST {STRAPI_URL}/api/session-details (server to server, Strapi REST content API)
// The Session Detail content type has draftAndPublish ON, but every entry is created, read and
// saved as PUBLISHED (`?status=published`): Postgres (sessions.status, the event's status) is the
// only visibility switch, so the content must always be readable. The organizer fills it
// (description, cover, resources) afterwards.

/**
 * What we send when a session is created: only the session's id (the Strapi field `sessionId`
 * is required and unique, so a second entry for the same session is refused with 400).
 */
export const strapiCreateSessionDetailRequestSchema = z.object({
  sessionId: z.uuid(),
});
export type StrapiCreateSessionDetailRequest = z.infer<
  typeof strapiCreateSessionDetailRequestSchema
>;

/** What Strapi answers. Only the fields we use are parsed; the rest is ignored. */
export const strapiCreateSessionDetailResponseSchema = z.object({
  data: z.object({
    /** Strapi 5 document id (a string): saved in sessions.cms_session_id. */
    documentId: z.string().min(1),
  }),
});
export type StrapiCreatedSessionDetail = z.infer<
  typeof strapiCreateSessionDetailResponseSchema
>["data"];

//* GET and PUT {STRAPI_URL}/api/session-details/:documentId?status=published

/** One Session Detail entry as Strapi returns it. Fields the organizer has not filled are null. */
export const strapiSessionDetailEntrySchema = z.object({
  documentId: z.string().min(1),
  description: strapiBlocksSchema.nullish(),
  prerequisites: z.string().nullish(),
  coverImage: strapiMediaSchema.nullish(),
  resources: z
    .array(z.object({ label: z.string(), url: z.string().nullish() }))
    .nullish(),
});
export type StrapiSessionDetailEntry = z.infer<
  typeof strapiSessionDetailEntrySchema
>;

export const strapiSessionDetailResponseSchema = z.object({
  data: strapiSessionDetailEntrySchema,
});

/** A Session Detail after the client cleaned it up: absolute image URL, no null lists. */
export type CmsSessionDetail = {
  documentId: string;
  description: StrapiBlocks;
  prerequisites: string | null;
  coverImage: CmsMedia | null;
  resources: { label: string; url: string | null }[];
};

/**
 * Fields we may change on a Session Detail. Only the keys that are present are sent, so a
 * missing key is left alone in Strapi and `null` clears the field. `resources` is replaced
 * as a whole.
 */
export type StrapiSessionDetailUpdate = Partial<{
  description: StrapiBlocks | null;
  prerequisites: string | null;
  resources: { label: string; url: string }[];
  /** Upload file id; null removes the cover. */
  coverImage: number | null;
}>;
