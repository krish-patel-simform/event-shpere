import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { noContent, ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  getVenueParam,
  updateVenueBodySchema,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// Public: a venue with its hall list. Guests see only an active venue and its active halls
// (anything else is a 404); a signed-in admin with VENUE_MANAGE sees everything.
export const GET = route<{ venueId: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const user = await getCurrentUser();
    const venue = await venueService.getVenueDetail(venueId, {
      canManage: user?.permissions.has(PERMISSION.VENUE_MANAGE) ?? false,
    });
    return ok(venueDetailResponseSchema.parse(venue));
  },
);

// An admin edits the venue's details; only the fields in the body change. 409 VENUE_EXISTS when the
// new name is taken in that city. Halls and status have their own routes.
export const PATCH = route<{ venueId: string }>(
  { permission: [PERMISSION.VENUE_MANAGE] },
  async ({ req, params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const body = await parseBody(req, updateVenueBodySchema);
    const venue = await venueService.updateVenue(venueId, body);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);

// An admin permanently deletes a venue that was never used. 409 VENUE_IN_USE when an event or a
// session (of any date) points at it: deactivate it with PATCH .../status instead.
export const DELETE = route<{ venueId: string }>(
  { permission: [PERMISSION.VENUE_MANAGE] },
  async ({ params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    await venueService.deleteVenue(venueId);
    return noContent();
  },
);
