import "server-only";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ValidationError } from "../../../core/http/errors";
import type { StrapiUploadedFile } from "../../cms";
import {
  EVENT_IMAGE_MAX_BODY_BYTES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_TYPES,
  type EventImageType,
} from "../constants";

/** An image upload as it arrived: streamed on to Strapi, never stored here. */
export type ImageUpload = {
  body: ReadableStream<Uint8Array>;
  /** The original "multipart/form-data; boundary=..." header. */
  contentType: string;
};

/**
 * The HTTP part of an upload, shared by every image route: must be multipart with a body,
 * and a body that declares itself too big is refused before a single byte moves. (The
 * service also counts the bytes while they stream, since content-length can be missing or lie.)
 */
export function readImageUpload(req: Request): ImageUpload {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data") || !req.body) {
    throw new ValidationError("Send the image as multipart/form-data");
  }
  if (Number(req.headers.get("content-length")) > EVENT_IMAGE_MAX_BODY_BYTES) {
    throw new ValidationError("The image must be 4 MB or smaller");
  }
  return { body: req.body, contentType };
}

/**
 * Checked AFTER Strapi stored the file, on what Strapi reports: the MIME type it detected
 * from the bytes (a PDF renamed to .jpg is still a PDF), real image dimensions, and the size.
 */
export function isAcceptableEventImage(file: StrapiUploadedFile): boolean {
  return (
    isEventImageType(file.mime) &&
    Boolean(file.width && file.height) &&
    file.size * 1024 <= EVENT_IMAGE_MAX_BYTES // Strapi's size is in KB
  );
}

function isEventImageType(mime: string): mime is EventImageType {
  return (EVENT_IMAGE_TYPES as readonly string[]).includes(mime);
}
