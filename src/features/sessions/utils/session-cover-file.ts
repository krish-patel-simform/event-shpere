import { SESSION_COVER_MAX_BYTES, SESSION_COVER_TYPES } from "../constants";

/** "JPG, PNG or WebP, up to 4 MB": the hint under the cover input. */
export const SESSION_COVER_HINT = `JPG, PNG or WebP, up to ${SESSION_COVER_MAX_BYTES / (1024 * 1024)} MB.`;

/** The value of the file input's `accept`: the types the server takes. */
export const SESSION_COVER_ACCEPT = SESSION_COVER_TYPES.join(",");

/**
 * Why a chosen file cannot be uploaded, or undefined when it can. Only an early message for the
 * organizer: the server checks the real type (from the bytes) and the size again.
 */
export function sessionCoverFileError(file: File): string | undefined {
  if (!(SESSION_COVER_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPG, PNG or WebP image.";
  }
  if (file.size > SESSION_COVER_MAX_BYTES) {
    return `The image must be ${SESSION_COVER_MAX_BYTES / (1024 * 1024)} MB or smaller.`;
  }
  return undefined;
}
