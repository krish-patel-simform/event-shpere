import { PERMISSION } from "@/src/core/auth/permission-catalog";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  PER_USER_HEADERS,
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
  {
    auth: "signed-in",
    permission: [PERMISSION.ORGANIZER_CREATE],
    rateLimit: "user-write",
  },
  async ({ req }) => {
    const body = await parseBody(req, createOrganizerBodySchema);
    const organizer = await organizerService.createOrganizer(body);
    return created(createOrganizerResponseSchema.parse(organizer));
  },
);

// GET /api/admin/organizers: one page of organizers for the admin. It carries names and emails,
// so no cache may keep it.
export const GET = route(
  {
    auth: "signed-in",
    permission: [PERMISSION.ORGANIZER_MANAGE],
    rateLimit: "user-read",
  },
  async ({ req }) => {
    const query = parseQuery(req, organizerQuerySchema);
    const { items, meta } = await organizerService.getOrganizerListItem(query);
    return paginated(getOrganizersResponseSchema.parse(items), meta, {
      headers: PER_USER_HEADERS,
    });
  },
);
