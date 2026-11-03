import "server-only";
import type { CurrentUser } from "../../../core/auth/server/auth-session";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ConflictError, NotFoundError } from "../../../core/http/errors";
import {
  organizerService,
  type OrganizerService,
} from "../../organizer/server";
import {
  hallBookingService,
  type HallBookingService,
} from "../../sessions/server";
import type {
  HallAvailabilityDto,
  HallAvailabilityQuery,
} from "../schemas/hall-availability.schemas";
import { venueRepository, type VenueRepository } from "./venue.repository";

export type HallAvailabilityDeps = {
  venueRepository: Pick<VenueRepository, "getVenueById">;
  /** Who holds which hall when (the sessions of every event). */
  hallBooking: Pick<HallBookingService, "findHeldSlots">;
  /** An organizer may plan events only while an admin's approval stands. */
  organizerVerification: Pick<OrganizerService, "assertVerifiedOrganizer">;
};

/**
 * Which halls of a venue are free for a time range. The create-event form asks it once the
 * venue and the dates are chosen. The permission (EVENT_CREATE) is checked by the route wrapper.
 */
export function createHallAvailabilityService(deps: HallAvailabilityDeps) {
  return {
    /**
     * The venue's ACTIVE halls (only those can take sessions), each with the times it is taken
     * inside [startAt, endAt). A session holds its hall while it is not cancelled and has a time
     * (draft or scheduled), whichever event it belongs to.
     *
     * A hall is `busy` when any session overlaps the range, even a part of it; `bookedSlots`
     * says which times. The slots are times only: another organizer's session titles never
     * leave here.
     */
    async getHallAvailability(
      venueId: string,
      query: HallAvailabilityQuery,
      currentUser: Pick<CurrentUser, "id" | "role">,
    ): Promise<HallAvailabilityDto[]> {
      await deps.organizerVerification.assertVerifiedOrganizer(currentUser);

      const found = await deps.venueRepository.getVenueById(venueId);
      if (!found) throw new NotFoundError("Venue not found");
      if (!found.venue.isActive) {
        throw new ConflictError(
          "VENUE_INACTIVE",
          "This venue is inactive. Choose an active venue",
        );
      }

      const halls = found.halls.filter((hall) => hall.isActive);
      const slots = await deps.hallBooking.findHeldSlots({
        hallIds: halls.map((hall) => hall.id),
        startAt: query.startAt,
        endAt: query.endAt,
      });

      return halls.map((hall) => {
        const bookedSlots = slots
          .filter((slot) => slot.hallId === hall.id)
          .map((slot) => ({
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
          }));
        return {
          id: hall.id,
          name: hall.name,
          capacity: hall.capacity,
          busy: bookedSlots.length > 0,
          bookedSlots,
        };
      });
    },
  };
}

export type HallAvailabilityService = ReturnType<
  typeof createHallAvailabilityService
>;

export const hallAvailabilityService = createHallAvailabilityService({
  venueRepository,
  hallBooking: hallBookingService,
  organizerVerification: organizerService,
});
