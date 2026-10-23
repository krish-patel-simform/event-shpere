import "server-only";
import { env } from "../../../config/env";
import {
  strapiCreateSpeakerResponseSchema,
  type StrapiCreatedSpeaker,
  type StrapiCreateSpeakerRequest,
} from "../schemas/strapi-speaker.schemas";
import { StrapiRequestError } from "./strapi-organizer.client";

export type StrapiSpeakerClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Strapi API token with create/delete on Speaker. */
  apiToken: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export function createStrapiSpeakerClient(config: StrapiSpeakerClientConfig) {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;

  function authHeaders(): Record<string, string> {
    if (!config.apiToken) {
      throw new Error(
        "Set STRAPI_API_TOKEN in .env to use the Strapi content API",
      );
    }
    return { authorization: `Bearer ${config.apiToken}` };
  }

  return {
    /**
     * Creates an empty Speaker entry as a DRAFT, so nothing is public until the speaker
     * fills the profile. `?status=draft` matters: Strapi's REST create publishes by default.
     */
    async createDraftSpeaker(
      input: StrapiCreateSpeakerRequest,
    ): Promise<StrapiCreatedSpeaker> {
      const response = await doFetch(
        `${config.baseUrl}/api/speakers?status=draft`,
        {
          method: "POST",
          headers: { ...authHeaders(), "content-type": "application/json" },
          body: JSON.stringify({ data: input }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi create speaker failed with HTTP ${response.status}`,
        );
      }

      return strapiCreateSpeakerResponseSchema.parse(await response.json())
        .data;
    },

    /** Deletes the entry (draft and published versions). Already gone (404) counts as done. */
    async deleteSpeaker(documentId: string): Promise<void> {
      const response = await doFetch(
        `${config.baseUrl}/api/speakers/${encodeURIComponent(documentId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok && response.status !== 404) {
        throw new StrapiRequestError(
          response.status,
          `Strapi delete speaker failed with HTTP ${response.status}`,
        );
      }
    },
  };
}

export type StrapiSpeakerClient = ReturnType<typeof createStrapiSpeakerClient>;

export const strapiSpeakerClient = createStrapiSpeakerClient({
  baseUrl: env.STRAPI_URL,
  apiToken: env.STRAPI_API_TOKEN,
});
