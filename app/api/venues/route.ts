import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import {
  created,
  paginated,
  parseBody,
  parseQuery,
  route,
} from "@/src/core/http";
import {
  createVenueBodySchema,
  createVenueResponseSchema,
  venueListQuerySchema,
  venueListResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// Public: a page of venues, with search (name or city), status, sort and paging. Guests only get
// active venues; a signed-in admin with VENUE_MANAGE sees retired ones too (and can filter them).
export const GET = route({ auth: "public" }, async ({ req }) => {
  const query = parseQuery(req, venueListQuerySchema);
  const user = await getCurrentUser();
  const { items, meta } = await venueService.listVenues(query, {
    canManage: user?.permissions.has(PERMISSION.VENUE_MANAGE) ?? false,
  });
  return paginated(venueListResponseSchema.parse(items), meta);
});

// An admin adds a venue together with its halls. Anyone else gets 401/403 from the wrapper.
export const POST = route(
  { permission: [PERMISSION.VENUE_MANAGE] },
  async ({ req, currentUser }) => {
    const body = await parseBody(req, createVenueBodySchema);
    const venue = await venueService.createVenue(body, currentUser);
    return created(createVenueResponseSchema.parse(venue));
  },
);
