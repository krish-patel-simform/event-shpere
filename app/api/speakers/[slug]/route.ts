import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { ok, parseInput, route } from "@/src/core/http";
import {
  speakerProfileResponseSchema,
  speakerSlugParamsSchema,
} from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// SPK-2: one public speaker profile (bio, expertise, links). Unknown slug → 404. Someone who
// manages every speaker (an admin) also gets the account's state, so "Resend invite" is offered
// only for a pending one; nobody else ever sees it.
export const GET = route<{ slug: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { slug } = parseInput(speakerSlugParamsSchema, await params);
    const user = await getCurrentUser();
    const speaker = await speakerService.getSpeakerBySlug(slug, {
      canManage: user?.permissions.has(PERMISSION.SPEAKER_MANAGE_ALL) ?? false,
    });
    return ok(speakerProfileResponseSchema.parse(speaker));
  },
);
