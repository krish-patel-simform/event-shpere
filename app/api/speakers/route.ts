import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  PER_USER_HEADERS,
  route,
} from "@/src/core/http";
import {
  createSpeakerBodySchema,
  createSpeakerResponseSchema,
  getSpeakersResponseSchema,
  listSpeakersQuerySchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// SPK-1: public speaker list (guests can view speakers), searchable by name. Someone who manages
// every speaker (an admin) also gets each account's state, so "Resend invite" is offered only for
// a pending one; nobody else ever sees it. The answer depends on the cookie, so no cache may keep it.
export const GET = route(
  { auth: "public", rateLimit: "public-read-ip" },
  async ({ req }) => {
    const query = parseQuery(req, listSpeakersQuerySchema);
    const user = await getCurrentUser();
    const { items, meta } = await speakerService.listSpeakers(query, {
      canManage: user?.permissions.has(PERMISSION.SPEAKER_MANAGE_ALL) ?? false,
    });
    return paginated(getSpeakersResponseSchema.parse(items), meta, {
      headers: PER_USER_HEADERS,
    });
  },
);

// An organizer or admin invites a speaker: an empty profile in Strapi + a set-password email.
export const POST = route(
  {
    auth: "signed-in",
    permission: [PERMISSION.SPEAKER_CREATE],
    rateLimit: "user-write",
  },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createSpeakerBodySchema);
    const speaker = await speakerService.createSpeaker(body, currentUser);
    return created(createSpeakerResponseSchema.parse(speaker));
  },
);
