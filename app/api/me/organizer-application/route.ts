import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, route } from "@/src/core/http";
import { ownOrganizerApplicationResponseSchema } from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// The signed-in organizer's own application: pending / verified / rejected (with the reason).
// No id in the URL: the organizer comes from the login, so nobody can read another's.
export const GET = route(
  {
    auth: "signed-in",
    permission: [PERMISSION.ORGANIZER_PROFILE_MANAGE_OWN],
  },
  async ({ currentUser }) => {
    const application = await organizerService.getOwnApplication(
      currentUser.id,
    );
    return ok(ownOrganizerApplicationResponseSchema.parse(application));
  },
);
