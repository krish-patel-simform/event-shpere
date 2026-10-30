import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { ok, parseInput, route } from "@/src/core/http";
import {
  getVenueParam,
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
