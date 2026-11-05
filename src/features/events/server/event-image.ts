import "server-only";
import type { StrapiUploadedFile } from "../../cms";
import {
  isAcceptableImage,
  readImageUpload as readUpload,
  type ImagePolicy,
  type ImageUpload,
} from "../../cms/server";
import {
  EVENT_IMAGE_MAX_BODY_BYTES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_TYPES,
} from "../constants";

export type { ImageUpload };

/** What an event image (cover, gallery) may be. The steps that enforce it live in the cms feature. */
export const EVENT_IMAGE_POLICY: ImagePolicy = {
  types: EVENT_IMAGE_TYPES,
  maxBytes: EVENT_IMAGE_MAX_BYTES,
  maxBodyBytes: EVENT_IMAGE_MAX_BODY_BYTES,
};

/** The HTTP part of an event image upload, shared by the cover and gallery routes. */
export function readImageUpload(req: Request): ImageUpload {
  return readUpload(req, EVENT_IMAGE_POLICY);
}

/** Checked AFTER Strapi stored the file, on what Strapi reports. */
export function isAcceptableEventImage(file: StrapiUploadedFile): boolean {
  return isAcceptableImage(file, EVENT_IMAGE_POLICY);
}
