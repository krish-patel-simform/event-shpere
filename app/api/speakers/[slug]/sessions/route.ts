import { paginated, parseInput, parseQuery, route } from "@/src/core/http";
import {
  listSpeakerSessionsQuerySchema,
  speakerSessionParams,
  speakerSessionsMetaSchema,
  speakerSessionsResponseSchema,
} from "@/src/features/speakers";
import { speakerSessionService } from "@/src/features/speakers/server";

// SPK-2: the sessions on a speaker's public page, one category per request:
// ?timeline=now|upcoming|past (default upcoming), grouped by event, paged by event. Open to
// anyone; only scheduled sessions of published events. An unknown or suspended slug is a 404.
export const GET = route<{ slug: string }>(
  { auth: "public" },
  async ({ req, params }) => {
    const { slug } = parseInput(speakerSessionParams, await params);
    const query = parseQuery(req, listSpeakerSessionsQuerySchema);
    const { items, meta } = await speakerSessionService.listSpeakerSessions(
      slug,
      query,
    );
    return paginated(
      speakerSessionsResponseSchema.parse(items),
      speakerSessionsMetaSchema.parse(meta),
    );
  },
);
