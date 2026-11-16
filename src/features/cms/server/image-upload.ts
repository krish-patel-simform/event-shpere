import "server-only";
import { createByteLimit } from "../../../core/http/byte-limit";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ValidationError } from "../../../core/http/errors";
import type { StrapiUploadedFile } from "../schemas/strapi-common.schemas";
import type { StrapiMediaClient } from "./strapi-media.client";

/** An image upload as it arrived: streamed on to Strapi, never stored here. */
export type ImageUpload = {
  body: ReadableStream<Uint8Array>;
  /** The original "multipart/form-data; boundary=..." header. */
  contentType: string;
};

/** What one kind of image (event cover, speaker photo, ...) may be. */
export type ImagePolicy = {
  /** The type Strapi detects from the file's bytes must be one of these. */
  types: readonly string[];
  /** Largest file, in bytes. */
  maxBytes: number;
  /** Largest request body: the file plus the multipart wrapper. */
  maxBodyBytes: number;
};

/**
 * The HTTP part of an upload, shared by every image route: must be multipart with a body, and
 * a body that declares itself too big is refused before a single byte moves. (The uploader also
 * counts the bytes while they stream, since content-length can be missing or lie.)
 */
export function readImageUpload(
  req: Request,
  policy: ImagePolicy,
): ImageUpload {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data") || !req.body) {
    throw new ValidationError("Send the image as multipart/form-data");
  }
  if (Number(req.headers.get("content-length")) > policy.maxBodyBytes) {
    throw new ValidationError(
      `The image must be ${policy.maxBytes / (1024 * 1024)} MB or smaller`,
    );
  }
  return { body: req.body, contentType };
}

/**
 * Checked AFTER Strapi stored the file, on what Strapi reports: the MIME type it detected
 * from the bytes (a PDF renamed to .jpg is still a PDF), real image dimensions, and the size.
 */
export function isAcceptableImage(
  file: StrapiUploadedFile,
  policy: ImagePolicy,
): boolean {
  return (
    policy.types.includes(file.mime) &&
    Boolean(file.width && file.height) &&
    file.size * 1024 <= policy.maxBytes // Strapi's size is in KB
  );
}

export type ImageUploaderConfig = {
  /** Strapi's media library: the upload and removing files again. */
  mediaClient: Pick<StrapiMediaClient, "uploadFiles" | "deleteFile">;
  policy: ImagePolicy;
  /** Names the feature in log lines: "events" → "[events] image upload to Strapi failed". */
  scope: string;
  /** What the file is called in log lines: "image", "photo". */
  noun: string;
  /** The error for a file that is not an acceptable image (the feature words the message). */
  invalid: () => Error;
  /** The error for Strapi being unreachable (the feature words the message). */
  unavailable: () => Error;
};

/**
 * Uploading one image to Strapi, the same way for every feature: stream it (counting the bytes
 * on the way), check what Strapi stored, and delete anything that is not acceptable. A feature
 * supplies its own limits and error messages, never its own copy of the steps.
 */
export function createImageUploader(config: ImageUploaderConfig) {
  /** Best effort: a file left behind only takes space in the media library. */
  async function removeUploadedFile(id: number): Promise<void> {
    try {
      await config.mediaClient.deleteFile(id);
    } catch (error) {
      console.error(
        `[${config.scope}] Strapi file ${id} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Streams the upload to Strapi and checks what Strapi stored: at least one file, and every file
   * a real image of an allowed type and size. If any file is not, ALL of them are deleted again
   * (a batch is saved whole or not at all). The whole body, all files together, is held to the
   * policy's body limit. `invalid` words the refusal (a batch needs other words than one image).
   */
  async function uploadImages(
    upload: ImageUpload,
    invalid: () => Error = config.invalid,
  ): Promise<StrapiUploadedFile[]> {
    const limit = createByteLimit(config.policy.maxBodyBytes);
    let result: Awaited<ReturnType<StrapiMediaClient["uploadFiles"]>>;
    try {
      result = await config.mediaClient.uploadFiles(
        upload.body.pipeThrough(limit.stream),
        upload.contentType,
      );
    } catch (error) {
      if (limit.exceeded()) throw invalid();
      console.error(
        `[${config.scope}] ${config.noun} upload to Strapi failed:`,
        error instanceof Error ? error.message : error,
      );
      throw config.unavailable();
    }
    // Strapi refused a file itself (e.g. a type its upload settings deny).
    if (!result.ok) throw invalid();

    const { files } = result;
    if (
      files.length === 0 ||
      !files.every((file) => isAcceptableImage(file, config.policy))
    ) {
      await Promise.all(files.map((file) => removeUploadedFile(file.id)));
      throw invalid();
    }
    return files;
  }

  /** Exactly one image (a cover, a photo): a body with more files is refused and they are deleted. */
  async function uploadOneImage(
    upload: ImageUpload,
  ): Promise<StrapiUploadedFile> {
    const [image, ...extra] = await uploadImages(upload);
    if (!image || extra.length > 0) {
      await Promise.all(
        [image, ...extra].map((file) =>
          file ? removeUploadedFile(file.id) : undefined,
        ),
      );
      throw config.invalid();
    }
    return image;
  }

  return { uploadImages, uploadOneImage, removeUploadedFile };
}

export type ImageUploader = ReturnType<typeof createImageUploader>;
