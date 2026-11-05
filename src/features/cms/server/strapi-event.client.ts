import "server-only";
import { env } from "../../../config/env";
import {
  strapiCreateEventPageResponseSchema,
  strapiEventPageEntrySchema,
  strapiEventPageListResponseSchema,
  strapiEventPageResponseSchema,
  type CmsEventPage,
  type StrapiCreatedEventPage,
  type StrapiCreateEventPageRequest,
  type StrapiEventPageEntry,
  type StrapiEventPageUpdate,
} from "../schemas/strapi-event.schemas";
import { createCmsMediaMapper } from "./strapi-media-mapper";
import { StrapiRequestError } from "./strapi-organizer.client";

export type StrapiEventClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Strapi API token: find/findOne/create/update/delete on Event Page. */
  apiToken: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export function createStrapiEventClient(config: StrapiEventClientConfig) {
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

  /** Strapi's shape → ours: absolute image URLs, empty strings and missing fields → null / []. */
  function toCmsEventPage(entry: StrapiEventPageEntry): CmsEventPage {
    return {
      documentId: entry.documentId,
      tagline: entry.tagline || null,
      about: entry.about ?? [],
      venueGuide: entry.venueGuide ?? [],
      coverImage: entry.coverImage ? toCmsMedia(entry.coverImage) : null,
      gallery: (entry.gallery ?? []).map(toCmsMedia),
      highlights: (entry.highlights ?? []).map((item) => ({
        title: item.title || null,
        description: item.description || null,
      })),
      faqs: (entry.faqs ?? []).map((item) => ({
        question: item.question,
        answer: item.answer ?? [],
      })),
      seo: {
        metaTitle: entry.seo?.metaTitle || null,
        metaDescription: entry.seo?.metaDescription || null,
      },
    };
  }

  /** Components and media are not in Strapi's answer unless asked for. */
  function populateParams(): URLSearchParams {
    return new URLSearchParams({
      "populate[coverImage]": "true",
      "populate[gallery]": "true",
      "populate[highlights]": "true",
      "populate[faqs]": "true",
      "populate[seo]": "true",
    });
  }

  return {
    /**
     * Creates the EMPTY Event Page for a new event (no ?status: the type has no draft/publish).
     * `eventId` is unique in Strapi, so a second page for the same event is refused (400).
     */
    async createEventPage(
      input: StrapiCreateEventPageRequest,
    ): Promise<StrapiCreatedEventPage> {
      const response = await doFetch(`${config.baseUrl}/api/event-pages`, {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ data: input }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        // Status only: the body is Strapi's error text, nothing we need to keep.
        throw new StrapiRequestError(
          response.status,
          `Strapi create event page failed with HTTP ${response.status}`,
        );
      }

      return strapiCreateEventPageResponseSchema.parse(await response.json())
        .data;
    },

    /** One page with its components and images. null = not found (deleted in Strapi). */
    async findEventPageById(documentId: string): Promise<CmsEventPage | null> {
      const response = await doFetch(
        `${config.baseUrl}/api/event-pages/${encodeURIComponent(documentId)}?${populateParams().toString()}`,
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
          `Strapi get event page failed with HTTP ${response.status}`,
        );
      }

      return toCmsEventPage(
        strapiEventPageResponseSchema.parse(await response.json()).data,
      );
    },

    /**
     * The pages of a whole list of events in ONE call, with only their cover image (a list card
     * shows the tagline and the banner, nothing else). An entry that fails validation is logged
     * and left out: that event just shows without CMS content. Strapi's order is not the list's:
     * match the pages by documentId. (The type has no draft/publish: which events are shown is
     * decided in Postgres, and only those ids are asked for.)
     */
    async findEventPagesByIds(documentIds: string[]): Promise<CmsEventPage[]> {
      if (documentIds.length === 0) return [];

      const params = new URLSearchParams({ "populate[coverImage]": "true" });
      documentIds.forEach((id, index) =>
        params.append(`filters[documentId][$in][${index}]`, id),
      );
      // Strapi pages its answers (25 by default): ask for exactly as many as we sent.
      params.set("pagination[pageSize]", String(documentIds.length));

      const response = await doFetch(
        `${config.baseUrl}/api/event-pages?${params.toString()}`,
        {
          method: "GET",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi list event pages failed with HTTP ${response.status}`,
        );
      }

      const { data } = strapiEventPageListResponseSchema.parse(
        await response.json(),
      );
      const pages: CmsEventPage[] = [];
      for (const raw of data) {
        const parsed = strapiEventPageEntrySchema.safeParse(raw);
        if (parsed.success) {
          pages.push(toCmsEventPage(parsed.data));
        } else {
          // Field paths only: the values are editorial content, nothing we need in logs.
          console.error(
            "[cms] invalid Strapi event page skipped:",
            parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
          );
        }
      }
      return pages;
    },

    /**
     * Changes only the fields in `data`. A list or component in `data` replaces the old one.
     * null = the page does not exist (deleted in Strapi).
     */
    async updateEventPage(
      documentId: string,
      data: StrapiEventPageUpdate,
    ): Promise<CmsEventPage | null> {
      const response = await doFetch(
        `${config.baseUrl}/api/event-pages/${encodeURIComponent(documentId)}?${populateParams().toString()}`,
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
          `Strapi update event page failed with HTTP ${response.status}`,
        );
      }

      return toCmsEventPage(
        strapiEventPageResponseSchema.parse(await response.json()).data,
      );
    },

    /** Deletes the page. Already gone (404) counts as done. */
    async deleteEventPage(documentId: string): Promise<void> {
      const response = await doFetch(
        `${config.baseUrl}/api/event-pages/${encodeURIComponent(documentId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok && response.status !== 404) {
        throw new StrapiRequestError(
          response.status,
          `Strapi delete event page failed with HTTP ${response.status}`,
        );
      }
    },
  };
}

export type StrapiEventClient = ReturnType<typeof createStrapiEventClient>;

export const strapiEventClient = createStrapiEventClient({
  baseUrl: env.STRAPI_URL,
  apiToken: env.STRAPI_API_TOKEN,
});
