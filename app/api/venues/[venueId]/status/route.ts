import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  getVenueParam,
  setVenueStatusBodySchema,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// An admin activates or deactivates a venue. Deactivating also deactivates all its halls, and is
// refused with 409 VENUE_HAS_SESSIONS while a session that is not over uses it. Activating turns
// the halls back on only with `activateHalls: "all"` (the default "none" keeps them inactive).
// body: { isActive: boolean, activateHalls?: "all" | "none" }
export const PATCH = route<{ venueId: string }>(
  { permission: [PERMISSION.VENUE_MANAGE], rateLimit: "user-write" },
  async ({ req, params }) => {
    const { venueId } = parseInput(getVenueParam, await params);
    const body = await parseBody(req, setVenueStatusBodySchema);
    const venue = await venueService.setVenueStatus(venueId, body);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);
