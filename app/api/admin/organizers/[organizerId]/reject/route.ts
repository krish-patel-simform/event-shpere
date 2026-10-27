import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  rejectOrganizerBodySchema,
  rejectOrganizerParamsSchema,
  rejectOrganizerResponseSchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// The admin rejects a pending applicant with a reason. The account is kept and the applicant
// gets an email with the reason. 409 if already verified or rejected. Rejecting is the other
// half of the verify decision, so it needs the same permission.
export const POST = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_VERIFY] },
  async ({ req, params, currentUser }) => {
    const { organizerId } = parseInput(
      rejectOrganizerParamsSchema,
      await params,
    );
    const { reason } = await parseBody(req, rejectOrganizerBodySchema);

    const organizer = await organizerService.rejectOrganizer(
      organizerId,
      currentUser.id,
      reason,
    );
    return ok(rejectOrganizerResponseSchema.parse(organizer));
  },
);
