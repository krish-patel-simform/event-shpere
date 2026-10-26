import "server-only";
import { env } from "../../../config/env";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import {
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  type ResendInviteResponseDto,
} from "../../auth";
import {
  accountInviteService,
  createAccountSetupToken,
  type AccountInviteService,
} from "../../auth/server";
import {
  strapiOrganizerClient,
  type StrapiOrganizerClient,
} from "../../cms/server";
import {
  enqueueAccountSetupEmail,
  enqueueCmsAccessEmail,
} from "../../email/server";
import type {
  CreateOrganizerBody,
  CreateOrganizerResponseDto,
  ListOrganizersQuery,
  OrganizerListItemDto,
  VerifyOrganizerResponseDto,
} from "../schemas/organizer.schemas";
import {
  toOrganizerDto,
  toOrganizerListItemDto,
  toVerifyOrganizerResponseDto,
} from "./organizer.dto";
import {
  organizerRepository,
  type OrganizerRepository,
} from "./organizer.repository";

export type OrganizerServiceDeps = {
  organizerRepository: Pick<
    OrganizerRepository,
    | "createOrganizerAccount"
    | "listOrganizers"
    | "verifyOrganizer"
    | "findForVerify"
    | "findInviteeById"
  >;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  accountInviteService: Pick<AccountInviteService, "resendAccountSetup">;
  strapiClient: Pick<
    StrapiOrganizerClient,
    "provisionOrganizerAccess" | "registerUrl"
  >;
  enqueueCmsAccessEmail: typeof enqueueCmsAccessEmail;
  appUrl: string;
};

export function createOrganizerService(deps: OrganizerServiceDeps) {
  /** Find-or-create the organizer's Strapi admin user. Any failure → 503, nothing saved. */
  async function provisionCmsAccess(organizer: {
    email: string;
    firstName: string;
    lastName: string;
  }) {
    try {
      return await deps.strapiClient.provisionOrganizerAccess({
        email: organizer.email,
        firstName: organizer.firstName,
        lastName: organizer.lastName,
      });
    } catch (error) {
      console.error(
        "[organizer] Strapi provisioning failed:",
        error instanceof Error ? error.message : error,
      );
      throw new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "Could not set up CMS access right now. Please try verifying again.",
      );
    }
  }

  return {
    /** ADM-1: admin creates a pending organizer; the setup email is queued after commit. */
    async createOrganizer(
      input: CreateOrganizerBody,
    ): Promise<CreateOrganizerResponseDto> {
      const setupToken = deps.createAccountSetupToken();

      const result = await deps.organizerRepository.createOrganizerAccount({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        organizationName: input.organizationName,
        organizationWebsite: input.organizationWebsite ?? null,
        setupToken: {
          tokenHash: setupToken.tokenHash,
          expiresAt: setupToken.expiresAt,
        },
      });
      if (!result.ok) {
        throw new ConflictError(
          "EMAIL_TAKEN",
          "An account with this email already exists",
        );
      }

      // Only now, after the commit: a rolled-back account must never get an email.
      // If Redis is down the account still exists; report it instead of failing (resend
      // comes with ADM-6).
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
          `[organizer] setup email not queued for user ${result.user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return toOrganizerDto(result.user, result.profile, setupEmailQueued);
    },

    /**
     * ADM-6: the admin re-sends the set-password invite to an organizer who has not set up
     * their account yet (the first email failed, or the link expired). Old links stop working.
     */
    async resendInvite(organizerId: string): Promise<ResendInviteResponseDto> {
      const invitee =
        await deps.organizerRepository.findInviteeById(organizerId);
      if (!invitee) throw new NotFoundError("Organizer not found");
      return deps.accountInviteService.resendAccountSetup(invitee.userId);
    },

    /** ADM-2: one page of organizers for the admin, optionally searched. */
    async getOrganizerListItem(
      query: ListOrganizersQuery,
    ): Promise<{ items: OrganizerListItemDto[]; meta: PageMeta }> {
      const { page, pageSize, searchField, searchValue } = query;

      const { rows, total } = await deps.organizerRepository.listOrganizers({
        // Search only when both are given (an empty value after trim counts as not given).
        search:
          searchField && searchValue
            ? { field: searchField, value: searchValue }
            : undefined,
        // page/pageSize (what the admin asks) → limit/offset (what SQL needs).
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: rows.map(toOrganizerListItemDto),
        meta: { page, pageSize, total },
      };
    },

    /**
     * ADM-4: the admin verifies an organizer. `verifierId` is the admin's id from the
     * access token (currentUser.id), never from the request body.
     * Verifying again is not an error: the original verifier and time are returned.
     *
     * Verifying also gives the organizer a Strapi (CMS) account, in this order:
     * 1. create (or find) the Strapi admin user → its id
     * 2. ONE update: verified_at + verified_by + cms_organizer_id
     * 3. queue the "set up your content access" email (after the commit)
     * Strapi down → 503 and nothing is saved; the admin clicks Verify again. If step 2
     * fails after step 1, the retry is still safe: Strapi returns the same user.
     */
    async verifyOrganizer(
      organizerId: string,
      verifierId: string,
    ): Promise<VerifyOrganizerResponseDto> {
      const organizer =
        await deps.organizerRepository.findForVerify(organizerId);
      if (!organizer) throw new NotFoundError("Organizer not found");

      // Already verified: no Strapi call, just return the original verification.
      const cmsAccess = organizer.verifiedAt
        ? null
        : await provisionCmsAccess(organizer);

      const row = await deps.organizerRepository.verifyOrganizer({
        organizerId,
        verifierId,
        cmsOrganizerId: cmsAccess?.id,
      });
      if (!row) throw new NotFoundError("Organizer not found");

      // justVerified: of two racing clicks only the one that saved sends the email.
      // No token = they already registered in Strapi: nothing to send.
      if (row.justVerified && cmsAccess?.registrationToken) {
        try {
          await deps.enqueueCmsAccessEmail(
            {
              to: organizer.email,
              firstName: organizer.firstName,
              registerUrl: deps.strapiClient.registerUrl(
                cmsAccess.registrationToken,
              ),
            },
            organizerId,
          );
        } catch (error) {
          // Verified and linked in Strapi either way; only the email is missing.
          // Message only: the job data holds the one-time register link.
          console.error(
            `[organizer] CMS access email not queued for organizer ${organizerId}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      // After the update both must be set. If not, the data is broken: fail loudly (500).
      if (!row.verifiedAt || !row.verifiedBy) {
        throw new Error(
          `Organizer ${organizerId} has no verifier after verifying`,
        );
      }
      return toVerifyOrganizerResponseDto({
        ...row,
        verifiedAt: row.verifiedAt,
        verifiedBy: row.verifiedBy,
      });
    },
  };
}

export const organizerService = createOrganizerService({
  organizerRepository,
  createAccountSetupToken,
  enqueueAccountSetupEmail,
  accountInviteService,
  strapiClient: strapiOrganizerClient,
  enqueueCmsAccessEmail,
  appUrl: env.APP_URL,
});
