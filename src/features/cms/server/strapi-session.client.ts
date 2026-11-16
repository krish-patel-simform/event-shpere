import "server-only";
import { env } from "../../../config/env";
import {
  strapiCreateSessionDetailResponseSchema,
  strapiSessionDetailResponseSchema,
  type CmsSessionDetail,
  type StrapiCreatedSessionDetail,
  type StrapiCreateSessionDetailRequest,
  type StrapiSessionDetailEntry,
  type StrapiSessionDetailUpdate,
} from "../schemas/strapi-session.schemas";
import { createCmsMediaMapper } from "./strapi-media-mapper";
import { StrapiRequestError } from "./strapi-organizer.client";

export type StrapiSessionClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Strapi API token: find/findOne/create/update/delete on Session Detail. */
  apiToken: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export function createStrapiSessionClient(config: StrapiSessionClientConfig) {
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

  const { toCmsMedia } = createCmsMediaMapper(config.baseUrl);

  /** Strapi's shape → ours: absolute image URL, missing lists → [], empty strings → null. */
  function toCmsSessionDetail(
    entry: StrapiSessionDetailEntry,
  ): CmsSessionDetail {
    return {
      documentId: entry.documentId,
      description: entry.description ?? [],
      prerequisites: entry.prerequisites || null,
      coverImage: entry.coverImage ? toCmsMedia(entry.coverImage) : null,
      resources: (entry.resources ?? []).map((item) => ({
        label: item.label,
        url: item.url || null,
      })),
    };
  }

  /**
   * The type has draft & publish, but EventSphere keeps everything PUBLISHED: Postgres decides
   * who may see a session, so the content must always be readable. `status=published` says it
   * out loud (like the speaker client), so a changed Strapi default cannot hide the entry.
   * Components are not in Strapi's
   * answer unless asked for.
   */
  function detailParams(): string {
    return new URLSearchParams({
      status: "published",
      "populate[coverImage]": "true",
      "populate[resources]": "true",
    }).toString();
  }

  return {
    /**
     * Creates the EMPTY Session Detail for a new session, PUBLISHED at once: its visibility is
     * decided in Postgres, never by Strapi's draft state. `sessionId` is unique in Strapi, so a
     * second entry for the same session is refused (400).
     */
    async createSessionDetail(
      input: StrapiCreateSessionDetailRequest,
    ): Promise<StrapiCreatedSessionDetail> {
      const response = await doFetch(
        `${config.baseUrl}/api/session-details?status=published`,
        {
          method: "POST",
          headers: { ...authHeaders(), "content-type": "application/json" },
          body: JSON.stringify({ data: input }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        // Status only: the body is Strapi's error text, nothing we need to keep.
        throw new StrapiRequestError(
          response.status,
          `Strapi create session detail failed with HTTP ${response.status}`,
        );
      }

      return strapiCreateSessionDetailResponseSchema.parse(
        await response.json(),
      ).data;
    },

    /** One entry with its resources. null = not found (deleted in Strapi). */
    async findSessionDetailById(
      documentId: string,
    ): Promise<CmsSessionDetail | null> {
      const response = await doFetch(
        `${config.baseUrl}/api/session-details/${encodeURIComponent(documentId)}?${detailParams()}`,
        {
          method: "GET",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi get session detail failed with HTTP ${response.status}`,
        );
      }

      return toCmsSessionDetail(
        strapiSessionDetailResponseSchema.parse(await response.json()).data,
      );
    },

    /**
     * Changes only the fields in `data`. A list in `data` replaces the old one. null = the
     * entry does not exist (deleted in Strapi).
     */
    async updateSessionDetail(
      documentId: string,
      data: StrapiSessionDetailUpdate,
    ): Promise<CmsSessionDetail | null> {
      const response = await doFetch(
        `${config.baseUrl}/api/session-details/${encodeURIComponent(documentId)}?${detailParams()}`,
        {
          method: "PUT",
          headers: { ...authHeaders(), "content-type": "application/json" },
          body: JSON.stringify({ data }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi update session detail failed with HTTP ${response.status}`,
        );
      }

      return toCmsSessionDetail(
        strapiSessionDetailResponseSchema.parse(await response.json()).data,
      );
    },

    /** Deletes the entry (all its versions). Already gone (404) counts as done. */
    async deleteSessionDetail(documentId: string): Promise<void> {
      const response = await doFetch(
        `${config.baseUrl}/api/session-details/${encodeURIComponent(documentId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok && response.status !== 404) {
        throw new StrapiRequestError(
          response.status,
          `Strapi delete session detail failed with HTTP ${response.status}`,
        );
      }
    },
  };
}

export type StrapiSessionClient = ReturnType<typeof createStrapiSessionClient>;

export const strapiSessionClient = createStrapiSessionClient({
  baseUrl: env.STRAPI_URL,
  apiToken: env.STRAPI_API_TOKEN,
});
