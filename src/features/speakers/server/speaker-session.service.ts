import "server-only";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { NotFoundError } from "../../../core/http/errors";
import type {
  ListSpeakerSessionsQuery,
  SpeakerSessionGroupDto,
} from "../schemas/speaker-sessions.schemas";
import { toSpeakerSessionGroupDto } from "./speaker-session.dto";
import {
  speakerSessionRepository,
  type SpeakerSessionRepository,
} from "./speaker-session.repository";
import {
  speakerRepository,
  type SpeakerRepository,
} from "./speaker.repository";

export type SpeakerSessionServiceDeps = {
  speakerRepository: Pick<SpeakerRepository, "findBySlug">;
  speakerSessionRepository: Pick<
    SpeakerSessionRepository,
    "listSpeakerSessions"
  >;
};

export function createSpeakerSessionService(deps: SpeakerSessionServiceDeps) {
  return {
    /**
     * One category of a speaker's sessions for the public profile, grouped by event. Open to
     * anyone; an unknown or suspended speaker is a 404, like the profile itself. `meta.total` is
     * the number of events in the category and `meta.totalSessions` the number of sessions.
     */
    async listSpeakerSessions(
      slug: string,
      { timeline, page, pageSize }: ListSpeakerSessionsQuery,
    ): Promise<{
      items: SpeakerSessionGroupDto[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalSessions: number;
      };
    }> {
      const speaker = await deps.speakerRepository.findBySlug(slug);
      if (!speaker) throw new NotFoundError("Speaker not found");

      const { groups, totalEvents, totalSessions } =
        await deps.speakerSessionRepository.listSpeakerSessions({
          speakerId: speaker.id,
          timeline,
          // page/pageSize (what the caller asks) → limit/offset (what SQL needs).
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });

      return {
        items: groups.map(toSpeakerSessionGroupDto),
        meta: { page, pageSize, total: totalEvents, totalSessions },
      };
    },
  };
}

export type SpeakerSessionService = ReturnType<
  typeof createSpeakerSessionService
>;

export const speakerSessionService = createSpeakerSessionService({
  speakerRepository,
  speakerSessionRepository,
});
