import { z } from "zod";
import {
  strapiBlocksSchema,
  strapiMediaSchema,
  type StrapiBlocks,
} from "./strapi-common.schemas";

//* POST {STRAPI_URL}/api/event-pages (server to server, Strapi REST content API)
// The Event Page content type has draftAndPublish off: Postgres events.status is the only
// visibility switch, so there is no ?status= on any call.

/**
 * What we send when an event is created: only the event's id (the Strapi field `eventId` is
 * required and unique); the organizer fills the content afterwards.
 */
export const strapiCreateEventPageRequestSchema = z.object({
  eventId: z.uuid(),
});
export type StrapiCreateEventPageRequest = z.infer<
  typeof strapiCreateEventPageRequestSchema
>;

/** What Strapi answers. Only the fields we use are parsed; the rest is ignored. */
export const strapiCreateEventPageResponseSchema = z.object({
  data: z.object({
    /** Strapi 5 document id (a string): saved in events.cms_event_id. */
    documentId: z.string().min(1),
  }),
});
export type StrapiCreatedEventPage = z.infer<
  typeof strapiCreateEventPageResponseSchema
>["data"];

//* GET and PUT {STRAPI_URL}/api/event-pages/:documentId

/** One Event Page entry as Strapi returns it. Fields the organizer has not filled are null. */
export const strapiEventPageEntrySchema = z.object({
  documentId: z.string().min(1),
  tagline: z.string().nullish(),
  about: strapiBlocksSchema.nullish(),
  venueGuide: strapiBlocksSchema.nullish(),
  coverImage: strapiMediaSchema.nullish(),
  gallery: z.array(strapiMediaSchema).nullish(),
  highlights: z
    .array(
      z.object({
        title: z.string().nullish(),
        description: z.string().nullish(),
      }),
    )
    .nullish(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: strapiBlocksSchema.nullish(),
      }),
    )
    .nullish(),
  seo: z
    .object({
      metaTitle: z.string().nullish(),
      metaDescription: z.string().nullish(),
    })
    .nullish(),
});
export type StrapiEventPageEntry = z.infer<typeof strapiEventPageEntrySchema>;

export const strapiEventPageResponseSchema = z.object({
  data: strapiEventPageEntrySchema,
});

/** One image of a page after the client cleaned it up: absolute URL, no undefined. */
export type CmsMedia = {
  /** Upload file id (needed to delete the file when the image is replaced or removed). */
  id: number;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

/** An Event Page after the client cleaned it up: absolute image URLs, no null lists. */
export type CmsEventPage = {
  documentId: string;
  tagline: string | null;
  about: StrapiBlocks;
  venueGuide: StrapiBlocks;
  coverImage: CmsMedia | null;
  gallery: CmsMedia[];
  highlights: { title: string | null; description: string | null }[];
  faqs: { question: string; answer: StrapiBlocks }[];
  seo: { metaTitle: string | null; metaDescription: string | null };
};

/**
 * Fields we may change on an Event Page. Only the keys that are present are sent, so a
 * missing key is left alone in Strapi and `null` clears the field. A list or a component
 * (highlights, faqs, seo, gallery) is replaced as a whole.
 */
export type StrapiEventPageUpdate = Partial<{
  tagline: string | null;
  about: StrapiBlocks | null;
  venueGuide: StrapiBlocks | null;
  highlights: { title: string; description: string | null }[];
  faqs: { question: string; answer: StrapiBlocks }[];
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
  } | null;
  /** Upload file id; null removes the cover. */
  coverImage: number | null;
  /** The upload file ids of the whole gallery, in order. */
  gallery: number[];
}>;
