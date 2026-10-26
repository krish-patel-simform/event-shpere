import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, route, ValidationError } from "@/src/core/http";
import {
  SPEAKER_PHOTO_MAX_BYTES,
  speakerPhotoResponseSchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// Room for the multipart wrapper around the file (boundaries, part headers).
const MAX_BODY_BYTES = SPEAKER_PHOTO_MAX_BYTES + 64 * 1024;

// Replaces the logged-in speaker's photo. The multipart body (file field "files") is
// streamed straight on to Strapi: it is never read into memory or stored on this server.
export const POST = route(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_MANAGE_OWN] },
  async ({ req, currentUser }) => {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data") || !req.body) {
      throw new ValidationError("Send the photo as multipart/form-data");
    }
    // Fast "no" for a declared oversize body; the service also counts the bytes as they
    // stream, since this header can be missing or wrong.
    if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
      throw new ValidationError("The photo must be 2 MB or smaller");
    }

    const result = await speakerService.replaceOwnPhoto(currentUser.id, {
      body: req.body,
      contentType,
    });
    return ok(speakerPhotoResponseSchema.parse(result));
  },
);
