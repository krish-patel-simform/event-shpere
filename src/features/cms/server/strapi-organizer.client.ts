import "server-only";
import { env } from "../../../config/env";
import {
  organizerAccessResponseSchema,
  type OrganizerAccess,
  type OrganizerAccessRequest,
} from "../schemas/strapi-organizer.schemas";

/** Strapi answered with an error status. `retryable` = trying again later may work. */
export class StrapiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StrapiRequestError";
  }

  /** 5xx and 429 are temporary; other 4xx mean our request or setup is wrong. */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export type StrapiOrganizerClientConfig = {
  /** e.g. http://localhost:1337 (no trailing slash). */
  baseUrl: string;
  /** Shared secret checked by Strapi's has-provision-secret policy. */
  provisionSecret: string | undefined;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export function createStrapiOrganizerClient(config: StrapiOrganizerClientConfig) {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;

  return {
    /**
     * Finds or creates the organizer's Strapi admin-panel user (Organizer role).
     * Safe to call again for the same email: Strapi returns the existing user.
     * Throws on any failure, so the background job is retried.
     */
    async provisionOrganizerAccess(
      input: OrganizerAccessRequest,
    ): Promise<OrganizerAccess> {
      if (!config.provisionSecret) {
        throw new Error(
          "Set STRAPI_PROVISION_SECRET in .env to provision CMS access",
        );
      }

      const response = await doFetch(
        `${config.baseUrl}/api/eventsphere/organizer-access`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-provision-secret": config.provisionSecret,
          },
          body: JSON.stringify(input),
          // A hung Strapi must not block the worker forever; the timeout makes the job retry.
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        // Status only: the body is Strapi's error text, nothing we need to keep.
        throw new StrapiRequestError(
          response.status,
          `Strapi organizer-access failed with HTTP ${response.status}`,
        );
      }

      return organizerAccessResponseSchema.parse(await response.json()).data;
    },

    /** The page where the organizer picks a password and activates the account. */
    registerUrl(registrationToken: string): string {
      return `${config.baseUrl}/admin/auth/register?registrationToken=${encodeURIComponent(registrationToken)}`;
    },
  };
}

export type StrapiOrganizerClient = ReturnType<
  typeof createStrapiOrganizerClient
>;

export const strapiOrganizerClient = createStrapiOrganizerClient({
  baseUrl: env.STRAPI_URL,
  provisionSecret: env.STRAPI_PROVISION_SECRET,
});
