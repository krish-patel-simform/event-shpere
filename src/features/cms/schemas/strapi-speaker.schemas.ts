import { z } from "zod";

//* POST {STRAPI_URL}/api/speakers?status=published (server to server, Strapi REST content API)

/** What we send when the speaker is invited: only the name; the speaker fills the rest later. */
export const strapiCreateSpeakerRequestSchema = z.object({
  name: z.string().min(1),
});
export type StrapiCreateSpeakerRequest = z.infer<
  typeof strapiCreateSpeakerRequestSchema
>;

/** What Strapi answers. Only the fields we use are parsed; the rest is ignored. */
export const strapiCreateSpeakerResponseSchema = z.object({
  data: z.object({
    /** Strapi 5 document id (a string): saved in speaker_profiles.cms_speaker_id. */
    documentId: z.string().min(1),
  }),
});
export type StrapiCreatedSpeaker = z.infer<
  typeof strapiCreateSpeakerResponseSchema
>["data"];

//* GET {STRAPI_URL}/api/speakers?filters[documentId][$in]=... and /api/speakers/:documentId

/**
 * Strapi "blocks" rich text: an array of nodes (paragraph, heading, list...). Only each
 * node's `type` is checked; the UI renders the tree with Strapi's blocks renderer, so it is
 * never turned into raw HTML.
 */
export const strapiBlocksSchema = z.array(z.looseObject({ type: z.string() }));
export type StrapiBlocks = z.infer<typeof strapiBlocksSchema>;

const strapiMediaSchema = z.object({
  /** Upload file id: what a Speaker's `photo` is set to, and what deletes the file. */
  id: z.number().int().positive(),
  /** Relative ("/uploads/x.jpg") for local uploads, absolute for a cloud provider. */
  url: z.string().min(1),
  alternativeText: z.string().nullish(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

/** One Speaker entry as Strapi returns it. Fields the speaker has not filled are null. */
export const strapiSpeakerEntrySchema = z.object({
  documentId: z.string().min(1),
  bio: strapiBlocksSchema.nullish(),
  photo: strapiMediaSchema.nullish(),
  company: z.string().nullish(),
  jobTitle: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  twitterUrl: z.string().nullish(),
  websiteUrl: z.string().nullish(),
  // A JSON field accepts anything; not a list of strings → no expertise, not a broken entry.
  expertise: z.array(z.string()).nullish().catch(null),
});
export type StrapiSpeakerEntry = z.infer<typeof strapiSpeakerEntrySchema>;

/** List answer: entries are parsed one by one, so one bad entry cannot break the list. */
export const strapiSpeakerListResponseSchema = z.object({
  data: z.array(z.unknown()),
});

export const strapiSpeakerResponseSchema = z.object({
  data: strapiSpeakerEntrySchema,
});

/** A Speaker entry after the client cleaned it up: absolute photo URL, no undefined. */
export type CmsSpeaker = {
  documentId: string;
  bio: StrapiBlocks;
  photo: {
    /** Upload file id (needed to delete the file when the photo is replaced). */
    id: number;
    url: string;
    alt: string | null;
    width: number | null;
    height: number | null;
  } | null;
  company: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  expertise: string[];
};

//* PUT {STRAPI_URL}/api/speakers/:documentId?status=published

/**
 * Fields we may change on a Speaker entry. Only the keys that are present are sent, so a
 * missing key is left alone in Strapi and `null` clears the field.
 */
export type StrapiSpeakerUpdate = Partial<{
  /** Copy of the name in Postgres, so entries stay readable in the Strapi admin. */
  name: string;
  bio: StrapiBlocks | null;
  company: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  expertise: string[];
  /** Upload file id; null removes the photo. */
  photo: number | null;
}>;

//* POST {STRAPI_URL}/api/upload (multipart, field "files"), streamed through from the browser

/** One uploaded file as Strapi reports it. Used to verify the upload after the fact. */
const strapiUploadedFileSchema = z.object({
  id: z.number().int().positive(),
  /** Detected by Strapi from the file's bytes, not just the name or the browser's claim. */
  mime: z.string(),
  /** In KILObytes (Strapi's unit). */
  size: z.number().nonnegative(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});
export type StrapiUploadedFile = z.infer<typeof strapiUploadedFileSchema>;

export const strapiUploadResponseSchema = z.array(strapiUploadedFileSchema);
