import { z } from "zod";

// Pieces every Strapi content type shares (speaker, event page, ...): rich text and media.

/**
 * Strapi "blocks" rich text: an array of nodes (paragraph, heading, list...). Only each
 * node's `type` is checked; the UI renders the tree with Strapi's blocks renderer, so it is
 * never turned into raw HTML.
 */
export const strapiBlocksSchema = z.array(z.looseObject({ type: z.string() }));
export type StrapiBlocks = z.infer<typeof strapiBlocksSchema>;

/** One image as Strapi returns it inside an entry (relative URL for local uploads). */
export const strapiMediaSchema = z.object({
  /** Upload file id: what a media field is set to, and what deletes the file. */
  id: z.number().int().positive(),
  /** Relative ("/uploads/x.jpg") for local uploads, absolute for a cloud provider. */
  url: z.string().min(1),
  alternativeText: z.string().nullish(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});
export type StrapiMedia = z.infer<typeof strapiMediaSchema>;

/**
 * One image after the client cleaned it up (absolute URL, no undefined): the shape every
 * feature's responses use for a cover, a photo or a gallery image.
 */
export const cmsMediaSchema = z.object({
  /** Upload file id (needed to delete the file when the image is replaced or removed). */
  id: z.number().int().positive(),
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type CmsMedia = z.infer<typeof cmsMediaSchema>;

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
