import "server-only";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ConflictError } from "../../../core/http/errors";
import {
  speakerBookingRepository,
  type SpeakerBookingRepository,
} from "./speaker-booking.repository";

export type SpeakerBookingDeps = {
  repository: Pick<SpeakerBookingRepository, "findOverlappingSessions">;
};

const listNames = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

/**
 * Who is busy when. A session holds its speakers while it is not cancelled and has a time
 * (draft or scheduled), across ALL events and halls, so one speaker can never be planned in two
 * places at the same time. The rule itself is in speaker-booking.repository; this is what the
 * session service calls.
 */
export function createSpeakerBookingService(deps: SpeakerBookingDeps) {
  return {
    /**
     * Call this before a session is saved with speakers and a time (created, moved, or given
     * new speakers). Throws 409 SPEAKER_BUSY when another session holds any of the speakers
     * during [startAt, endAt). `exceptSessionId` is the session being edited, so it does not
     * clash with its own old slot.
     *
     * The answer names the busy speakers (the organizer chose them, so they are not a secret)
     * and says WHEN they are taken, never by what or by whom: the other session may belong to
     * another organizer.
     */
    async assertSpeakersFree(params: {
      speakerIds: string[];
      startAt: Date;
      endAt: Date;
      exceptSessionId?: string;
    }): Promise<void> {
      const clashes = await deps.repository.findOverlappingSessions(params);
      if (clashes.length === 0) return;

      // One name per speaker, even when they are busy in several sessions.
      const names = [...new Set(clashes.map((slot) => slot.name))];
      const verb = names.length === 1 ? "is" : "are";

      throw new ConflictError(
        "SPEAKER_BUSY",
        `${listNames.format(names)} ${verb} already booked for another session during that time. Choose another speaker or time.`,
        {
          conflicts: clashes.map((slot) => ({
            speakerId: slot.speakerId,
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
          })),
        },
      );
    },
  };
}

export type SpeakerBookingService = ReturnType<
  typeof createSpeakerBookingService
>;

export const speakerBookingService = createSpeakerBookingService({
  repository: speakerBookingRepository,
});
