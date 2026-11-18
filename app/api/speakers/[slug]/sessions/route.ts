import {
  paginated,
  parseInput,
  parseQuery,
  PUBLIC_CACHE_HEADERS,
  route,
} from "@/src/core/http";
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
  { auth: "public", rateLimit: "public-read-ip" },
  async ({ req, params }) => {
    const { slug } = parseInput(speakerSessionParams, await params);
    const query = parseQuery(req, listSpeakerSessionsQuerySchema);
    const { items, meta } = await speakerSessionService.listSpeakerSessions(
      slug,
      query,
    );
    // The same for every viewer: the CDN may keep it briefly, which also fits "now" (30 s).
    return paginated(
      speakerSessionsResponseSchema.parse(items),
      speakerSessionsMetaSchema.parse(meta),
      { headers: PUBLIC_CACHE_HEADERS },
    );
  },
);
