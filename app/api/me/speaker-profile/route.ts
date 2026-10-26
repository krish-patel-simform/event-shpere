import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, route } from "@/src/core/http";
import {
  ownSpeakerProfileResponseSchema,
  updateOwnSpeakerProfileBodySchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// The logged-in speaker's own profile. No id in the URL: the speaker comes from the login,
// so nobody can reach another speaker's profile here.

// The edit form's current values (bio as plain text, links as stored).
export const GET = route(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_MANAGE_OWN] },
  async ({ currentUser }) => {
    const profile = await speakerService.getOwnProfile(currentUser.id);
    return ok(ownSpeakerProfileResponseSchema.parse(profile));
  },
);

// Saves only the fields that were sent: names in Postgres, the rest in Strapi.
export const PATCH = route(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_MANAGE_OWN] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, updateOwnSpeakerProfileBodySchema);
    const profile = await speakerService.updateOwnProfile(currentUser.id, body);
    return ok(ownSpeakerProfileResponseSchema.parse(profile));
  },
);
