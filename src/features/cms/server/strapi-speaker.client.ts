import "server-only";
import { env } from "../../../config/env";
import {
  strapiCreateSpeakerResponseSchema,
  strapiSpeakerEntrySchema,
  strapiSpeakerListResponseSchema,
  strapiSpeakerResponseSchema,
  strapiUploadResponseSchema,
  type CmsSpeaker,
  type StrapiCreatedSpeaker,
  type StrapiCreateSpeakerRequest,
  type StrapiSpeakerEntry,
  type StrapiSpeakerUpdate,
  type StrapiUploadedFile,
} from "../schemas/strapi-speaker.schemas";
import { StrapiRequestError } from "./strapi-organizer.client";

export type StrapiSpeakerClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Strapi API token: find/findOne/create/update/delete on Speaker, upload/destroy on Upload. */
  apiToken: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Uploads send a file, so they get longer than the JSON calls. */
  uploadTimeoutMs?: number;
};

export function createStrapiSpeakerClient(config: StrapiSpeakerClientConfig) {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;
  const uploadTimeoutMs = config.uploadTimeoutMs ?? 30_000;

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

  /** Strapi's shape → ours: absolute photo URL, empty strings and missing fields → null. */
  function toCmsSpeaker(entry: StrapiSpeakerEntry): CmsSpeaker {
    const media = entry.photo;
    return {
      documentId: entry.documentId,
      bio: entry.bio ?? [],
      photo: media
        ? {
            id: media.id,
            url: absoluteUrl(media.url),
            alt: media.alternativeText || null,
            width: media.width ?? null,
            height: media.height ?? null,
          }
        : null,
      company: entry.company || null,
      jobTitle: entry.jobTitle || null,
      linkedinUrl: entry.linkedinUrl || null,
      twitterUrl: entry.twitterUrl || null,
      websiteUrl: entry.websiteUrl || null,
      expertise: entry.expertise ?? [],
    };
  }

  async function get(path: string, params: URLSearchParams): Promise<Response> {
    // Public pages show published content only; Strapi's default, said explicitly.
    params.set("status", "published");
    params.set("populate[photo]", "true");
    return doFetch(`${config.baseUrl}${path}?${params.toString()}`, {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  return {
    /**
     * Creates the Speaker entry PUBLISHED, so public pages always find it, with an empty
     * profile until the speaker fills it. Strapi publishes by default; `?status=published`
     * says so on purpose, in case that default ever changes.
     */
    async createSpeaker(
      input: StrapiCreateSpeakerRequest,
    ): Promise<StrapiCreatedSpeaker> {
      const response = await doFetch(
        `${config.baseUrl}/api/speakers?status=published`,
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

    /**
     * The published entries for these documentIds, in ONE request (no call per speaker).
     * An entry that fails validation is logged and left out: that speaker just has no CMS
     * content, the others are not affected. Order is Strapi's; match them by documentId.
     */
    async findSpeakersByIds(documentIds: string[]): Promise<CmsSpeaker[]> {
      if (documentIds.length === 0) return [];

      const params = new URLSearchParams();
      documentIds.forEach((id, index) =>
        params.append(`filters[documentId][$in][${index}]`, id),
      );
      // Strapi pages its answers (25 by default): ask for exactly as many as we sent.
      params.set("pagination[pageSize]", String(documentIds.length));

      const response = await get("/api/speakers", params);
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi list speakers failed with HTTP ${response.status}`,
        );
      }

      const { data } = strapiSpeakerListResponseSchema.parse(
        await response.json(),
      );
      const speakers: CmsSpeaker[] = [];
      for (const raw of data) {
        const parsed = strapiSpeakerEntrySchema.safeParse(raw);
        if (parsed.success) {
          speakers.push(toCmsSpeaker(parsed.data));
        } else {
          // Field paths only: the values are editorial content, nothing we need in logs.
          console.error(
            `[cms] invalid Strapi speaker ${documentIdOf(raw)} skipped:`,
            parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
          );
        }
      }
      return speakers;
    },

    /** One published entry. null = not found (deleted or unpublished in Strapi). */
    async findSpeakerById(documentId: string): Promise<CmsSpeaker | null> {
      const response = await get(
        `/api/speakers/${encodeURIComponent(documentId)}`,
        new URLSearchParams(),
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi get speaker failed with HTTP ${response.status}`,
        );
      }

      return toCmsSpeaker(
        strapiSpeakerResponseSchema.parse(await response.json()).data,
      );
    },

    /**
     * Changes only the fields in `data` and publishes the result in the same call
     * (Strapi 5: update writes the draft, then publishes it when status=published).
     * null = the entry does not exist (deleted in Strapi).
     */
    async updateSpeaker(
      documentId: string,
      data: StrapiSpeakerUpdate,
    ): Promise<CmsSpeaker | null> {
      const params = new URLSearchParams({
        status: "published",
        // So the answer includes the photo, e.g. right after a new one was set.
        "populate[photo]": "true",
      });
      const response = await doFetch(
        `${config.baseUrl}/api/speakers/${encodeURIComponent(documentId)}?${params.toString()}`,
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
          `Strapi update speaker failed with HTTP ${response.status}`,
        );
      }

      return toCmsSpeaker(
        strapiSpeakerResponseSchema.parse(await response.json()).data,
      );
    },

    /**
     * Streams a multipart body (as the browser sent it) straight to Strapi's media library:
     * nothing is buffered or stored on our server. `contentType` must be the original
     * "multipart/form-data; boundary=..." header, and the file field must be named "files".
     * Strapi refusing the file (400/413/415: wrong type, too big) → `{ ok: false }`.
     */
    async uploadFiles(
      body: ReadableStream<Uint8Array>,
      contentType: string,
    ): Promise<
      { ok: true; files: StrapiUploadedFile[] } | { ok: false; status: number }
    > {
      // Node's fetch needs duplex "half" to send a stream as the request body.
      const init: RequestInit & { duplex: "half" } = {
        method: "POST",
        headers: { ...authHeaders(), "content-type": contentType },
        body,
        duplex: "half",
        signal: AbortSignal.timeout(uploadTimeoutMs),
      };
      // Fixed URL: never forward a client query (e.g. Strapi's ?id= would REPLACE a file).
      const response = await doFetch(`${config.baseUrl}/api/upload`, init);

      if ([400, 413, 415].includes(response.status)) {
        return { ok: false, status: response.status };
      }
      if (!response.ok) {
        throw new StrapiRequestError(
          response.status,
          `Strapi upload failed with HTTP ${response.status}`,
        );
      }
      return {
        ok: true,
        files: strapiUploadResponseSchema.parse(await response.json()),
      };
    },

    /** Removes a file from the media library. Already gone (404) counts as done. */
    async deleteFile(id: number): Promise<void> {
      const response = await doFetch(
        `${config.baseUrl}/api/upload/files/${id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new StrapiRequestError(
          response.status,
          `Strapi delete file failed with HTTP ${response.status}`,
        );
      }
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

/** For log lines about an entry that did not parse. */
function documentIdOf(raw: unknown): string {
  return typeof raw === "object" &&
    raw !== null &&
    "documentId" in raw &&
    typeof raw.documentId === "string"
    ? raw.documentId
    : "(no documentId)";
}

export type StrapiSpeakerClient = ReturnType<typeof createStrapiSpeakerClient>;

export const strapiSpeakerClient = createStrapiSpeakerClient({
  baseUrl: env.STRAPI_URL,
  apiToken: env.STRAPI_API_TOKEN,
});
