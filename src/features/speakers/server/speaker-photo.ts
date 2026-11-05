import "server-only";
import {
  IMAGE_MULTIPART_OVERHEAD_BYTES,
  type StrapiUploadedFile,
} from "../../cms";
import { isAcceptableImage, type ImagePolicy } from "../../cms/server";
import { SPEAKER_PHOTO_MAX_BYTES, SPEAKER_PHOTO_TYPES } from "../constants";

/** Largest request body accepted for a photo upload: the file plus the multipart wrapper. */
export const SPEAKER_PHOTO_MAX_BODY_BYTES =
  SPEAKER_PHOTO_MAX_BYTES + IMAGE_MULTIPART_OVERHEAD_BYTES;

/** What a speaker photo may be. The steps that enforce it live in the cms feature. */
export const SPEAKER_PHOTO_POLICY: ImagePolicy = {
  types: SPEAKER_PHOTO_TYPES,
  maxBytes: SPEAKER_PHOTO_MAX_BYTES,
  maxBodyBytes: SPEAKER_PHOTO_MAX_BODY_BYTES,
};

/** Checked AFTER Strapi stored the file, on what Strapi reports. */
export function isAcceptablePhoto(file: StrapiUploadedFile): boolean {
  return isAcceptableImage(file, SPEAKER_PHOTO_POLICY);
}
