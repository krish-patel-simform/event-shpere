import "server-only";
import type { StrapiUploadedFile } from "../../cms";
import {
  SPEAKER_PHOTO_MAX_BYTES,
  SPEAKER_PHOTO_TYPES,
  type SpeakerPhotoType,
} from "../constants";

// The multipart wrapper (boundaries, headers) adds a few hundred bytes around the file.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/** Largest request body accepted for a photo upload: the file plus the multipart wrapper. */
export const SPEAKER_PHOTO_MAX_BODY_BYTES =
  SPEAKER_PHOTO_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;

/**
 * Counts bytes while the body streams through to Strapi and cuts it off past the limit.
 * Needed even with a content-length check: that header can be missing (chunked) or lie.
 */
export function createByteLimit(maxBytes: number) {
  let total = 0;
  let exceeded = false;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        controller.error(new Error(`Upload is larger than ${maxBytes} bytes`));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return { stream, exceeded: () => exceeded };
}

/**
 * Checked AFTER Strapi stored the file, on what Strapi reports: the MIME type it detected
 * from the bytes (a PDF renamed to .jpg is still a PDF), real image dimensions, and the size.
 */
export function isAcceptablePhoto(file: StrapiUploadedFile): boolean {
  return (
    isSpeakerPhotoType(file.mime) &&
    Boolean(file.width && file.height) &&
    file.size * 1024 <= SPEAKER_PHOTO_MAX_BYTES // Strapi's size is in KB
  );
}

function isSpeakerPhotoType(mime: string): mime is SpeakerPhotoType {
  return (SPEAKER_PHOTO_TYPES as readonly string[]).includes(mime);
}
