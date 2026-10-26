import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { resendInviteResponseSchema } from "@/src/features/auth";
import { speakerSlugParamsSchema } from "@/src/features/speakers";
import { speakerService } from "@/src/features/speakers/server";

// ADM-6: an organizer or admin re-sends the set-password invite to a speaker who has not set
// up their account yet. The old link stops working. Only pending accounts; 60s cooldown.
export const POST = route<{ slug: string }>(
  { auth: "signed-in", permission: [PERMISSION.SPEAKER_CREATE] },
  async ({ params }) => {
    const { slug } = parseInput(speakerSlugParamsSchema, await params);
    const result = await speakerService.resendInvite(slug);
    return ok(resendInviteResponseSchema.parse(result));
  },
);
