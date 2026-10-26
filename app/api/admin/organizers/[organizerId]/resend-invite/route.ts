import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { resendInviteResponseSchema } from "@/src/features/auth";
import { resendOrganizerInviteParamsSchema } from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// ADM-6: the admin re-sends the set-password invite to an organizer who has not set up their
// account yet. The old link stops working. Only pending accounts; 60s cooldown.
export const POST = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_CREATE] },
  async ({ params }) => {
    const { organizerId } = parseInput(
      resendOrganizerInviteParamsSchema,
      await params,
    );
    const result = await organizerService.resendInvite(organizerId);
    return ok(resendInviteResponseSchema.parse(result));
  },
);
