import { IMAGE_MULTIPART_OVERHEAD_BYTES } from "../cms";

// Event image rules: the server enforces them, the UI uses the same values for its hints.

/** Only real images. The type Strapi detects from the file's bytes must be one of these. */
export const EVENT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type EventImageType = (typeof EVENT_IMAGE_TYPES)[number];

// 4 MB: the image passes through a Vercel function, whose request body limit is 4.5 MB
// (the multipart wrapper below counts too). Check the current limit in Vercel's docs.
export const EVENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/** Largest request body accepted for one image upload: the file plus the multipart wrapper. */
export const EVENT_IMAGE_MAX_BODY_BYTES =
  EVENT_IMAGE_MAX_BYTES + IMAGE_MULTIPART_OVERHEAD_BYTES;

/** At most this many gallery images per event. */
export const EVENT_GALLERY_MAX_IMAGES = 10;

/**
 * Several gallery images go up in ONE request, and that request is capped (see the 4.5 MB
 * function body limit above), so the images of one upload may add up to this much, not 4 MB each.
 * A bigger selection is uploaded in more than one go.
 */
export const EVENT_GALLERY_BATCH_MAX_BYTES = EVENT_IMAGE_MAX_BYTES;

export const EVENT_CREATE_MAX_PER_DAY = 20;

/**
 * Name of the file field in the multipart form. The body is streamed to Strapi as-is, and
 * Strapi's upload API reads its files from a field called "files".
 */
export const EVENT_IMAGE_FORM_FIELD = "files";
