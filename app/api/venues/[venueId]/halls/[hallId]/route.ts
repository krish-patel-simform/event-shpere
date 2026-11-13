import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { ok, parseBody, parseInput, route } from "@/src/core/http";
import {
  getHallParam,
  hallDetailResponseSchema,
  updateHallBodySchema,
  venueDetailResponseSchema,
} from "@/src/features/venues";
import { venueService } from "@/src/features/venues/server";

// Public: one hall of a venue. Guests see it only when the hall and its venue are both active
// (else 404); a signed-in admin with HALL_MANAGE sees it either way.
export const GET = route<{ venueId: string; hallId: string }>(
  { auth: "public" },
  async ({ params }) => {
    const { venueId, hallId } = parseInput(getHallParam, await params);
    const user = await getCurrentUser();
    const hall = await venueService.getHallDetail(venueId, hallId, {
      canManage: user?.permissions.has(PERMISSION.HALL_MANAGE) ?? false,
    });
    return ok(hallDetailResponseSchema.parse(hall));
  },
);

// An admin renames a hall and/or changes its seats; only the fields in the body change. 409
// HALL_EXISTS (name taken in this venue) or HALL_HAS_SESSIONS (a session that is not over yet uses
// the hall, so neither its name nor its seats can change; the message names the sessions).
// Returns the venue with its halls.
export const PATCH = route<{ venueId: string; hallId: string }>(
  { permission: [PERMISSION.HALL_MANAGE] },
  async ({ req, params }) => {
    const { venueId, hallId } = parseInput(getHallParam, await params);
    const body = await parseBody(req, updateHallBodySchema);
    const venue = await venueService.updateHall(venueId, hallId, body);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);

// An admin permanently deletes a hall. Refused with 409 when it is the venue's last hall or when
// sessions use it (turn it off with PATCH .../halls/status instead). Returns the remaining halls.
export const DELETE = route<{ venueId: string; hallId: string }>(
  { permission: [PERMISSION.HALL_MANAGE] },
  async ({ params }) => {
    const { venueId, hallId } = parseInput(getHallParam, await params);
    const venue = await venueService.deleteHall(venueId, hallId);
    return ok(venueDetailResponseSchema.parse(venue));
  },
);
