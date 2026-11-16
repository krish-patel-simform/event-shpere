import "server-only";
import { env } from "../../../config/env";
import {
  strapiUploadResponseSchema,
  type StrapiUploadedFile,
} from "../schemas/strapi-common.schemas";
import { StrapiRequestError } from "./strapi-organizer.client";

export type StrapiMediaClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Strapi API token: upload/destroy on Upload. */
  apiToken: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Uploads send a file, so they get longer than the JSON calls. */
  uploadTimeoutMs?: number;
};

/** Strapi's media library, independent of which content type uses the file. */
export function createStrapiMediaClient(config: StrapiMediaClientConfig) {
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

  return {
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
  };
}

export type StrapiMediaClient = ReturnType<typeof createStrapiMediaClient>;

export const strapiMediaClient = createStrapiMediaClient({
  baseUrl: env.STRAPI_URL,
  apiToken: env.STRAPI_API_TOKEN,
});
