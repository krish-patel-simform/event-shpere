import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  reopenOrganizerParamsSchema,
  reopenOrganizerResponseSchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// The admin reopens a rejected application: the rejection is cleared and the applicant is
// pending again (approve or reject again). 409 if it is not rejected. It is the same decision
// as verify and reject, so it needs the same permission. No body: nothing to type.
export const POST = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_VERIFY] },
  async ({ params }) => {
    const { organizerId } = parseInput(
      reopenOrganizerParamsSchema,
      await params,
    );
    const organizer = await organizerService.reopenOrganizer(organizerId);
    return ok(reopenOrganizerResponseSchema.parse(organizer));
  },
);
