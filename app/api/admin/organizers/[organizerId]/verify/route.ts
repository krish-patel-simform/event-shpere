import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  verifyOrganizerParamsSchema,
  verifyOrganizerResponseSchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// ADM-4: the admin verifies an organizer. Verifying again returns the original verification.
export const POST = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_VERIFY] },
  async ({ params, currentUser }) => {
    const { organizerId } = parseInput(
      verifyOrganizerParamsSchema,
      await params,
    );

    const organizer = await organizerService.verifyOrganizer(
      organizerId,
      currentUser.id,
    );
    return ok(verifyOrganizerResponseSchema.parse(organizer));
  },
);
