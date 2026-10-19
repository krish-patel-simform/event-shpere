import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseBody, route } from "@/src/core/http";
import {
  createOrganizerBodySchema,
  organizerResponseSchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// ADM-1: admin creates an organizer; the organizer gets a set-password email.
export const POST = route(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_CREATE] },
  async ({ req }) => {
    const body = await parseBody(req, createOrganizerBodySchema);
    const organizer = await organizerService.createOrganizer(body);
    return created(organizerResponseSchema.parse(organizer));
  },
);
