import "server-only";
import { env } from "../../../config/env";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ServiceUnavailableError,
} from "../../../core/http/errors";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../../auth";
import { createAccountSetupToken } from "../../auth/server";
import {
  strapiSpeakerClient,
  type StrapiSpeakerClient,
} from "../../cms/server";
import { enqueueAccountSetupEmail } from "../../email/server";
import type {
  CreateSpeakerBody,
  CreateSpeakerResponseDto,
} from "../schemas/speaker.schemas";
import { toSpeakerDto } from "./speaker.dto";
import {
  speakerRepository,
  type SpeakerRepository,
} from "./speaker.repository";
import { createSpeakerSlug } from "./speaker-slug";

export type SpeakerServiceDeps = {
  speakerRepository: Pick<SpeakerRepository, "emailExists" | "createSpeaker">;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  strapiClient: Pick<
    StrapiSpeakerClient,
    "createDraftSpeaker" | "deleteSpeaker"
  >;
  createSlug: typeof createSpeakerSlug;
  appUrl: string;
};

const emailTaken = () =>
  new ConflictError("EMAIL_TAKEN", "An account with this email already exists");

export function createSpeakerService(deps: SpeakerServiceDeps) {
  /** The empty draft Speaker entry in Strapi. Any failure → 503, nothing saved. */
  async function createCmsDraft(name: string) {
    try {
      return await deps.strapiClient.createDraftSpeaker({ name });
    } catch (error) {
      console.error(
        "[speakers] Strapi draft speaker not created:",
        error instanceof Error ? error.message : error,
      );
      throw new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "Could not create the speaker right now. Please try again.",
      );
    }
  }

  /**
   * Undo for createCmsDraft when the DB insert did not happen. Best effort: if it fails too,
   * an unused draft stays in Strapi (never public); log its id so it can be removed by hand.
   */
  async function removeCmsDraft(documentId: string) {
    try {
      await deps.strapiClient.deleteSpeaker(documentId);
    } catch (error) {
      console.error(
        `[speakers] orphan Strapi draft speaker ${documentId} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    /**
     * An organizer (or admin) invites a speaker, in this order:
     * 1. email already used → 409 (before Strapi, so no orphan drafts in the common case)
     * 2. Strapi: empty DRAFT Speaker entry → documentId (Strapi down → 503, nothing saved)
     * 3. ONE transaction: user (pending) + speaker role + profile (with documentId) + token
     *    (fails → the Strapi draft is deleted again)
     * 4. after the commit: queue the existing account-setup email
     * The speaker fills bio, photo, links... later, after setting a password.
     * `createdBy` is the inviter's id from the access token, never from the request body.
     */
    async createSpeaker(
      input: CreateSpeakerBody,
      createdBy: string,
    ): Promise<CreateSpeakerResponseDto> {
      if (await deps.speakerRepository.emailExists(input.email)) {
        throw emailTaken();
      }

      const cmsSpeaker = await createCmsDraft(
        `${input.firstName} ${input.lastName}`,
      );
      const setupToken = deps.createAccountSetupToken();

      let result: Awaited<ReturnType<SpeakerRepository["createSpeaker"]>>;
      try {
        result = await deps.speakerRepository.createSpeaker({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          slug: deps.createSlug(input.firstName, input.lastName),
          cmsSpeakerId: cmsSpeaker.documentId,
          createdBy,
          setupToken: {
            tokenHash: setupToken.tokenHash,
            expiresAt: setupToken.expiresAt,
          },
        });
      } catch (error) {
        await removeCmsDraft(cmsSpeaker.documentId);
        throw error;
      }
      if (!result.ok) {
        // Lost a race with another invite for the same email.
        await removeCmsDraft(cmsSpeaker.documentId);
        throw emailTaken();
      }

      // Only now, after the commit: a rolled-back account must never get an email.
      // If Redis is down the account still exists; report it instead of failing.
      let setupEmailQueued = true;
      try {
        await deps.enqueueAccountSetupEmail({
          to: result.user.email,
          firstName: result.user.firstName,
          passwordSetupUrl: `${deps.appUrl}/set-password?token=${encodeURIComponent(setupToken.token)}`,
          loginUrl: `${deps.appUrl}/login`,
          expiresInHours: ACCOUNT_SETUP_TOKEN_TTL_HOURS,
        });
      } catch (error) {
        setupEmailQueued = false;
        // Message only: the error could carry the job data, which holds the setup link.
        console.error(
          `[speakers] setup email not queued for user ${result.user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return toSpeakerDto(result.user, result.profile, setupEmailQueued);
    },
  };
}

export const speakerService = createSpeakerService({
  speakerRepository,
  createAccountSetupToken,
  enqueueAccountSetupEmail,
  strapiClient: strapiSpeakerClient,
  createSlug: createSpeakerSlug,
  appUrl: env.APP_URL,
});
