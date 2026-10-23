import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseBody, route } from "@/src/core/http";
import {
  createSpeakerBodySchema,
  createSpeakerResponseSchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// An organizer or admin invites a speaker: a draft profile in Strapi + a set-password email.
export const POST = route(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_CREATE] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createSpeakerBodySchema);
    const speaker = await speakerService.createSpeaker(body, currentUser.id);
    return created(createSpeakerResponseSchema.parse(speaker));
  },
);
