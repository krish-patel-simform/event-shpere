// Speaker photo rules: the server enforces them, the UI uses the same values for its hints.

/** Only real images. The type Strapi detects from the file's bytes must be one of these. */
export const SPEAKER_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type SpeakerPhotoType = (typeof SPEAKER_PHOTO_TYPES)[number];

export const SPEAKER_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Name of the file field in the multipart form. The body is streamed to Strapi as-is, and
 * Strapi's upload API reads its files from a field called "files".
 */
export const SPEAKER_PHOTO_FORM_FIELD = "files";
