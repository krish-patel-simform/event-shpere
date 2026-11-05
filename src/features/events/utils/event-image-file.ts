import {
  EVENT_GALLERY_BATCH_MAX_BYTES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_TYPES,
} from "../constants";
import { plural } from "./event-display";

/** "JPG, PNG or WebP, up to 4 MB": the hint under an image input. */
export const EVENT_IMAGE_HINT = `JPG, PNG or WebP, up to ${EVENT_IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;

/** The hint under the gallery input: the images of one upload share the request's size limit. */
export const EVENT_GALLERY_HINT = `JPG, PNG or WebP. Up to ${EVENT_GALLERY_BATCH_MAX_BYTES / (1024 * 1024)} MB in total per upload.`;

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

/** The images picked for the next gallery upload, and why some of the chosen ones were left out. */
export type GallerySelection = {
  files: File[];
  /** undefined when every chosen file was taken. */
  error: string | undefined;
};

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Adds the files the organizer just chose to the ones already picked. A file is left out (and the
 * message says why) when it is not an allowed image, when the gallery has no room for it (`room`
 * = how many more the gallery can take, counting the ones already picked), or when it would push
 * the upload past the size one request can carry. A file picked twice is taken once, silently.
 * The rest are kept, in the order chosen. Only an early message: the server checks it all again.
 */
export function addToGallerySelection(
  current: readonly File[],
  chosen: readonly File[],
  room: number,
): GallerySelection {
  const files = [...current];
  let bytes = files.reduce((sum, file) => sum + file.size, 0);
  const messages: string[] = [];
  let noRoom = 0;
  let tooBig = 0;

  for (const file of chosen) {
    const problem = eventImageFileError(file);
    if (problem) {
      messages.push(`${file.name}: ${problem}`);
    } else if (files.some((picked) => sameFile(picked, file))) {
      continue;
    } else if (files.length >= room) {
      noRoom += 1;
    } else if (bytes + file.size > EVENT_GALLERY_BATCH_MAX_BYTES) {
      tooBig += 1;
    } else {
      files.push(file);
      bytes += file.size;
    }
  }

  if (noRoom > 0) {
    messages.push(
      room > 0
        ? `The gallery has room for ${plural(room, "more image")}; ${plural(noRoom, "image")} left out.`
        : "The gallery is full.",
    );
  }
  if (tooBig > 0) {
    messages.push(
      `One upload holds at most ${EVENT_GALLERY_BATCH_MAX_BYTES / (1024 * 1024)} MB of images; ${plural(tooBig, "image")} left out. Upload these first, then add the rest.`,
    );
  }
  return { files, error: messages.length > 0 ? messages.join(" ") : undefined };
}
