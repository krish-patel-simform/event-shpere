import { PERMISSION } from "@/src/core/auth/permission-catalog";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  route,
} from "@/src/core/http";
import {
  createOrganizerBodySchema,
  createOrganizerResponseSchema,
  getOrganizersResponseSchema,
  organizerQuerySchema,
} from "@/src/features/organizer";
import { organizerService } from "@/src/features/organizer/server";

// ADM-1: admin creates an organizer; the organizer gets a set-password email.
export const POST = route(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_CREATE] },
  async ({ req }) => {
    const body = await parseBody(req, createOrganizerBodySchema);
    const organizer = await organizerService.createOrganizer(body);
    return created(createOrganizerResponseSchema.parse(organizer));
  },
);

//* GET api/auth/organizer

export const GET = route(
  { auth: "signed-in", permission: [PERMISSION.ORGANIZER_MANAGE] },
  async ({ req }) => {
    const query = parseQuery(req, organizerQuerySchema);
    const { items, meta } = await organizerService.getOrganizerListItem(query);
    return paginated(getOrganizersResponseSchema.parse(items), meta);
  },
);
