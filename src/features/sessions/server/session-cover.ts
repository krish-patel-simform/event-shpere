import "server-only";
import {
  readImageUpload,
  type ImagePolicy,
  type ImageUpload,
} from "../../cms/server";
import {
  SESSION_COVER_MAX_BODY_BYTES,
  SESSION_COVER_MAX_BYTES,
  SESSION_COVER_TYPES,
} from "../constants";

export type { ImageUpload };

/** What a session cover may be. The steps that enforce it live in the cms feature. */
export const SESSION_COVER_POLICY: ImagePolicy = {
  types: SESSION_COVER_TYPES,
  maxBytes: SESSION_COVER_MAX_BYTES,
  maxBodyBytes: SESSION_COVER_MAX_BODY_BYTES,
};

/** The HTTP part of a cover upload, for the cover route. */
export function readCoverUpload(req: Request): ImageUpload {
  return readImageUpload(req, SESSION_COVER_POLICY);
}
