import { PERMISSION } from "@/src/core/auth/permission-catalog";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  route,
} from "@/src/core/http";
import {
  createSpeakerBodySchema,
  createSpeakerResponseSchema,
  getSpeakersResponseSchema,
  listSpeakersQuerySchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// SPK-1: public speaker list (guests can view speakers), searchable by name.
export const GET = route({ auth: "public" }, async ({ req }) => {
  const query = parseQuery(req, listSpeakersQuerySchema);
  const { items, meta } = await speakerService.listSpeakers(query);
  return paginated(getSpeakersResponseSchema.parse(items), meta);
});

// An organizer or admin invites a speaker: an empty profile in Strapi + a set-password email.
export const POST = route(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_CREATE] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createSpeakerBodySchema);
    const speaker = await speakerService.createSpeaker(body, currentUser.id);
    return created(createSpeakerResponseSchema.parse(speaker));
  },
);
