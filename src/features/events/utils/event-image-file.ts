import { EVENT_IMAGE_MAX_BYTES, EVENT_IMAGE_TYPES } from "../constants";

/** "JPG, PNG or WebP, up to 4 MB": the hint under an image input. */
export const EVENT_IMAGE_HINT = `JPG, PNG or WebP, up to ${EVENT_IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;

/** The value of the file input's `accept`: the types the server takes. */
export const EVENT_IMAGE_ACCEPT = EVENT_IMAGE_TYPES.join(",");

/**
 * Why a chosen file cannot be uploaded, or undefined when it can. Only an early message for the
 * organizer: the server checks the real type (from the bytes) and the size again.
 */
export function eventImageFileError(file: File): string | undefined {
  if (!(EVENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPG, PNG or WebP image.";
  }
  if (file.size > EVENT_IMAGE_MAX_BYTES) {
    return `The image must be ${EVENT_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`;
  }
  return undefined;
}
