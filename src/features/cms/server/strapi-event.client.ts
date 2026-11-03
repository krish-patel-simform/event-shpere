import "server-only";
import { env } from "../../../config/env";
import {
  strapiCreateEventPageResponseSchema,
  strapiEventPageResponseSchema,
  type CmsEventPage,
  type CmsMedia,
  type StrapiCreatedEventPage,
  type StrapiCreateEventPageRequest,
  type StrapiEventPageEntry,
  type StrapiEventPageUpdate,
} from "../schemas/strapi-event.schemas";
import type { StrapiMedia } from "../schemas/strapi-common.schemas";
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

  /** Local uploads come back as "/uploads/x.jpg": make them absolute so the browser can load them. */
  function absoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    return `${config.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function toCmsMedia(media: StrapiMedia): CmsMedia {
    return {
      id: media.id,
      url: absoluteUrl(media.url),
      alt: media.alternativeText || null,
      width: media.width ?? null,
      height: media.height ?? null,
    };
  }

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
