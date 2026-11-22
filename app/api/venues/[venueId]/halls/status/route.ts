import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  getVenueParam,
  setHallsStatusBodySchema,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// An admin activates or deactivates all halls of a venue, or the listed ones. 409 VENUE_INACTIVE
// when activating halls of an inactive venue; 409 HALL_HAS_SESSIONS when deactivating a hall that
// a session that is not over uses.
// body: { isActive: boolean, halls: "all" | ["<hall id>", ...] }
export const PATCH = route<{ venueId: string }>(
  { permission: [PERMISSION.HALL_MANAGE], rateLimit: "user-write" },
  async ({ req, params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const body = await parseBody(req, setHallsStatusBodySchema);
    const venue = await venueService.setHallsStatus(venueId, body);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);
