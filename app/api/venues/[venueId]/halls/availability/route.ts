import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, parseQuery, route } from "@/src/core/http";
import {
  getVenueParam,
  hallAvailabilityQuerySchema,
  hallAvailabilityResponseSchema,
} from "@/src/features/venues";
import { hallAvailabilityService } from "@/src/features/venues/server";

// Which halls of a venue are free for a time range: the create-event form asks it once the venue
// and the dates are chosen. Needs EVENT_CREATE (an approved organizer; an admin has no such
// permission). Each hall comes with the times it is taken, never with what is booked or by whom.
export const GET = route<{ venueId: string }>(
  { permission: [PERMISSION.EVENT_CREATE] },
  async ({ req, params, currentUser }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const query = parseQuery(req, hallAvailabilityQuerySchema);
    const halls = await hallAvailabilityService.getHallAvailability(
      venueId,
      query,
      currentUser,
    );
    return ok(hallAvailabilityResponseSchema.parse(halls));
  },
);
