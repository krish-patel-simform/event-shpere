import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { noContent, ok, parseInput, route } from "@/src/core/http";
import {
  deleteOrganizerParamsSchema,
  getOrganizerParamsSchema,
  organizerDetailResponseSchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// ADM-2: the admin opens one application (the review page): the organisation, the applicant's
// account and whether another organizer uses the same name or website. 404 if there is none.
// Read with the same permission as the list.
export const GET = route<{ organizerId: string }>(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_MANAGE] },
  async ({ params }) => {
    const { organizerId } = parseInput(getOrganizerParamsSchema, await params);
    const organizer = await organizerService.getOrganizerDetail(organizerId);
    return ok(organizerDetailResponseSchema.parse(organizer));
  },
);

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
