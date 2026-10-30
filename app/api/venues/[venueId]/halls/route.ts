import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { created, parseBody, parseInput, route } from "@/src/core/http";
import {
  createHallSchema,
  getVenueParam,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// An admin adds one hall to an existing venue. Returns the venue with its updated hall list.
export const POST = route<{ venueId: string }>(
  { permission: [PERMISSION.HALL_MANAGE] },
  async ({ req, params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const body = await parseBody(req, createHallSchema);
    const venue = await venueService.addHall(venueId, body);
    return created(venueDetailResponseSchema.parse(venue));
  },
);
