import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { noContent, parseInput, route } from "@/src/core/http";
import { deleteOrganizerParamsSchema } from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// The admin deletes a junk/spam applicant: their account is deleted (204). Only while the
// organizer is not verified (409 otherwise). A real applicant is rejected instead
// (POST .../reject), which keeps the account and the reason. Same permission as verifying.
export const DELETE = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_VERIFY] },
  async ({ params }) => {
    const { organizerId } = parseInput(
      deleteOrganizerParamsSchema,
      await params,
    );
    await organizerService.deleteOrganizer(organizerId);
    return noContent();
  },
);
