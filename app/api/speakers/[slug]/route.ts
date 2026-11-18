import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { ok, parseInput, PER_USER_HEADERS, route } from "@/src/core/http";
import {
  speakerProfileResponseSchema,
  speakerSlugParamsSchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// SPK-2: one public speaker profile (bio, expertise, links). Unknown slug → 404. Someone who
// manages every speaker (an admin) also gets the account's state, so "Resend invite" is offered
// only for a pending one; nobody else ever sees it. The answer depends on the cookie, so no cache
// may keep it.
export const GET = route<{ slug: string }>(
  { auth: "public", rateLimit: "public-read-ip" },
  async ({ params }) => {
    const { slug } = parseInput(speakerSlugParamsSchema, await params);
    const user = await getCurrentUser();
    const speaker = await speakerService.getSpeakerBySlug(slug, {
      canManage: user?.permissions.has(PERMISSION.SPEAKER_MANAGE_ALL) ?? false,
    });
    return ok(speakerProfileResponseSchema.parse(speaker), {
      headers: PER_USER_HEADERS,
    });
  },
);
