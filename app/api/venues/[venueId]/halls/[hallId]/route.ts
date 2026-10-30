import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { getCurrentUser } from "@/src/core/auth/server/auth-guards";
import { ok, parseInput, route } from "@/src/core/http";
import {
  getHallParam,
  hallDetailResponseSchema,
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
