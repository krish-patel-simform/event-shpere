import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  getVenueParam,
  setVenueStatusBodySchema,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// An admin retires or reopens a venue. Retiring also retires all its halls.
export const PATCH = route<{ venueId: string }>(
  { permission: [PERMISSION.VENUE_MANAGE] },
  async ({ req, params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const body = await parseBody(req, setVenueStatusBodySchema);
    const venue = await venueService.setVenueStatus(venueId, body);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);
