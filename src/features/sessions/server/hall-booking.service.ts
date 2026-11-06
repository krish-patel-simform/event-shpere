import "server-only";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ConflictError } from "../../../core/http/errors";
import {
  hallBookingRepository,
  type HallBookingRepository,
} from "./hall-booking.repository";

export type HallBookingDeps = {
  repository: Pick<
    HallBookingRepository,
    "findOverlappingSessions" | "findHeldSlotsInHalls"
  >;
};

/**
 * Who holds which hall when. A session holds its hall while it is not cancelled and has a time
 * (draft or scheduled), across ALL events, so two organizers can never plan the same hall at the
 * same time. The rule itself is in hall-booking.repository; this is what services call.
 */
export function createHallBookingService(deps: HallBookingDeps) {
  return {
    /**
     * Call this before a session is saved with a hall and a time (created, placed or moved).
     * Throws 409 HALL_BUSY when another session holds the hall during [startAt, endAt).
     * `exceptSessionId` is the session being edited, so it does not clash with its own old slot.
     *
     * The answer says WHEN the hall is taken, never by what or by whom: the other session may
     * belong to another organizer.
     */
    async assertHallFree(params: {
      hallId: string;
      startAt: Date;
      endAt: Date;
      exceptSessionId?: string;
    }): Promise<void> {
      const clashes = await deps.repository.findOverlappingSessions(params);
      if (clashes.length === 0) return;

      throw new ConflictError(
        "HALL_BUSY",
        "This hall is already booked during that time. Choose another hall or time.",
        {
          conflicts: clashes.map((slot) => ({
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
          })),
        },
      );
    },

    /**
     * When these halls are taken inside [startAt, endAt) (one query for all of them): each
     * slot is a time range only. A hall with no slot is free for the whole range; one with a
     * slot is only partly taken unless the slots cover the range.
     */
    findHeldSlots(params: {
      hallIds: string[];
      startAt: Date;
      endAt: Date;
      /** The session being edited: its own booking is left out. */
      exceptSessionId?: string;
    }): Promise<{ hallId: string; startAt: Date; endAt: Date }[]> {
      return deps.repository.findHeldSlotsInHalls(params);
    },
  };
}

export type HallBookingService = ReturnType<typeof createHallBookingService>;

export const hallBookingService = createHallBookingService({
  repository: hallBookingRepository,
});
