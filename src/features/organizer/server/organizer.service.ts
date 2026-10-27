import "server-only";
import { env } from "../../../config/env";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import type { CurrentUser } from "../../../core/auth/server/auth-session";
import {
  ConflictError,
  ForbiddenError,
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
  enqueueOrganizerRejectedEmail,
} from "../../email/server";
import type {
  CreateOrganizerBody,
  CreateOrganizerResponseDto,
  ListOrganizersQuery,
  OrganizerListItemDto,
  OwnOrganizerApplicationDto,
  RejectOrganizerResponseDto,
  ReopenOrganizerResponseDto,
  VerifyOrganizerResponseDto,
} from "../schemas/organizer.schemas";
import {
  toOrganizerDto,
  toOrganizerListItemDto,
  toOwnOrganizerApplicationDto,
  toRejectOrganizerResponseDto,
  toReopenOrganizerResponseDto,
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
    | "deleteUnverifiedOrganizer"
    | "rejectPendingOrganizer"
    | "reopenRejectedOrganizer"
    | "findVerificationByUserId"
    | "findApplicationByUserId"
  >;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  accountInviteService: Pick<AccountInviteService, "resendAccountSetup">;
  strapiClient: Pick<
    StrapiOrganizerClient,
    "provisionOrganizerAccess" | "registerUrl"
  >;
  enqueueCmsAccessEmail: typeof enqueueCmsAccessEmail;
  enqueueOrganizerRejectedEmail: typeof enqueueOrganizerRejectedEmail;
  appUrl: string;
};

function rejectedConflict() {
  return new ConflictError(
    "ORGANIZER_REJECTED",
    "A rejected organizer cannot be verified until the application is reopened",
  );
}

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
    /**
     * Organizer tools (inviting speakers, and later events, sessions, polls...) need the
     * admin's approval. Call this first in every service method an organizer can use, before
     * anything is saved or sent. Their role holds those permissions from sign-up, so the
     * permission check alone does not stop an organizer who is still under review.
     * Only organizers are checked: an admin has no organizer profile and is never blocked.
     */
    async assertVerifiedOrganizer(
      user: Pick<CurrentUser, "id" | "role">,
    ): Promise<void> {
      if (user.role !== "organizer") return;

      const profile = await deps.organizerRepository.findVerificationByUserId(
        user.id,
      );
      // Its own code, so the client can show "rejected" instead of "waiting for approval".
      if (profile?.rejectedAt) {
        throw new ForbiddenError(
          "Your organizer application was rejected",
          "ORGANIZER_REJECTED",
        );
      }
      // No profile at all is broken data: deny, never allow by default.
      if (!profile?.verifiedAt) {
        throw new ForbiddenError(
          "Your organizer account is waiting for admin approval",
          "ORGANIZER_NOT_VERIFIED",
        );
      }
    },

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

    /**
     * The admin deletes a junk/spam applicant: the whole account goes. A real applicant is
     * rejected instead (rejectOrganizer), which keeps the account and the reason. Only while
     * not verified: a verified organizer may already own events and a CMS account (409).
     */
    async deleteOrganizer(organizerId: string): Promise<void> {
      const result =
        await deps.organizerRepository.deleteUnverifiedOrganizer(organizerId);
      if (result === "not_found") {
        throw new NotFoundError("Organizer not found");
      }
      if (result === "already_verified") {
        throw new ConflictError(
          "ORGANIZER_ALREADY_VERIFIED",
          "A verified organizer cannot be deleted",
        );
      }
    },

    /**
     * The admin rejects a pending applicant with a reason. The account is kept: the applicant
     * can still log in as an attendee and sees the reason. Until the admin reopens it
     * (reopenOrganizer) it cannot be approved, and only a pending application can be rejected
     * (409 otherwise).
     * `rejecterId` is the admin's id from the access token, never from the request body.
     * The rejection email (with the reason) is queued after the commit.
     */
    async rejectOrganizer(
      organizerId: string,
      rejecterId: string,
      reason: string,
    ): Promise<RejectOrganizerResponseDto> {
      const row = await deps.organizerRepository.rejectPendingOrganizer({
        organizerId,
        rejecterId,
        reason,
      });
      if (!row) throw new NotFoundError("Organizer not found");

      if (!row.justRejected) {
        if (row.verifiedAt) {
          throw new ConflictError(
            "ORGANIZER_ALREADY_VERIFIED",
            "A verified organizer cannot be rejected",
          );
        }
        throw new ConflictError(
          "ORGANIZER_ALREADY_REJECTED",
          "This organizer has already been rejected",
        );
      }

      // After the update all three must be set. If not, the data is broken: fail loudly (500).
      if (!row.rejectedAt || !row.rejectedBy || !row.rejectionReason) {
        throw new Error(
          `Organizer ${organizerId} has no rejection after rejecting`,
        );
      }

      // Only now, after the commit. Rejected either way; a missing email is reported, not thrown.
      // The key holds the rejection time: an application can be reopened and rejected again, and
      // that second rejection must still send its own email (a reused job id would be dropped).
      let rejectionEmailQueued = true;
      try {
        await deps.enqueueOrganizerRejectedEmail(
          {
            to: row.email,
            firstName: row.organizerFirstName,
            organizationName: row.organizationName,
            reason: row.rejectionReason,
            loginUrl: `${deps.appUrl}/login`,
          },
          `${organizerId}-${row.rejectedAt.getTime()}`,
        );
      } catch (error) {
        rejectionEmailQueued = false;
        console.error(
          `[organizer] rejection email not queued for organizer ${organizerId}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return toRejectOrganizerResponseDto(
        {
          ...row,
          rejectedAt: row.rejectedAt,
          rejectedBy: row.rejectedBy,
          rejectionReason: row.rejectionReason,
        },
        rejectionEmailQueued,
      );
    },

    /**
     * The admin reopens a rejected application: the rejection (who, when, why) is cleared and
     * the applicant is pending again, so the admin can approve or reject again. Only a rejected
     * application can be reopened (409 otherwise). The applicant is not emailed.
     */
    async reopenOrganizer(
      organizerId: string,
    ): Promise<ReopenOrganizerResponseDto> {
      const row =
        await deps.organizerRepository.reopenRejectedOrganizer(organizerId);
      if (!row) throw new NotFoundError("Organizer not found");

      if (!row.justReopened) {
        throw new ConflictError(
          "ORGANIZER_NOT_REJECTED",
          "Only a rejected organizer can be reopened",
        );
      }
      return toReopenOrganizerResponseDto(row);
    },

    /**
     * The signed-in user's own organizer application: status, and the reason if rejected.
     * The user comes from the login, so nobody can read someone else's application.
     */
    async getOwnApplication(
      userId: string,
    ): Promise<OwnOrganizerApplicationDto> {
      const row =
        await deps.organizerRepository.findApplicationByUserId(userId);
      if (!row) throw new NotFoundError("No organizer application found");
      return toOwnOrganizerApplicationDto(row);
    },

    /**
     * ADM-2: one page of organizers for the admin, optionally searched and filtered by
     * verification (`pending` = the approval queue).
     */
    async getOrganizerListItem(
      query: ListOrganizersQuery,
    ): Promise<{ items: OrganizerListItemDto[]; meta: PageMeta }> {
      const { page, pageSize, searchField, searchValue, verification } = query;

      const { rows, total } = await deps.organizerRepository.listOrganizers({
        // Search only when both are given (an empty value after trim counts as not given).
        search:
          searchField && searchValue
            ? { field: searchField, value: searchValue }
            : undefined,
        verification: verification ?? undefined,
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
     * An applicant whose email is not verified yet → 409, before anything is created.
     * A rejected applicant → 409: rejected is final.
     */
    async verifyOrganizer(
      organizerId: string,
      verifierId: string,
    ): Promise<VerifyOrganizerResponseDto> {
      const organizer =
        await deps.organizerRepository.findForVerify(organizerId);
      if (!organizer) throw new NotFoundError("Organizer not found");

      // Before Strapi: a rejected applicant must not get a CMS account.
      if (organizer.rejectedAt) throw rejectedConflict();

      // Checked here, not only in the UI: the API can be called directly. An email never goes
      // back to unverified, so checking before the update leaves no race.
      if (!organizer.verifiedAt && !organizer.emailVerifiedAt) {
        throw new ConflictError(
          "EMAIL_NOT_VERIFIED",
          "This organizer has not verified their email yet",
        );
      }

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
      // A reject saved between our check and the update: the update changed nothing.
      if (!row.justVerified && row.rejectedAt) throw rejectedConflict();

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

export type OrganizerService = ReturnType<typeof createOrganizerService>;

export const organizerService = createOrganizerService({
  organizerRepository,
  createAccountSetupToken,
  enqueueAccountSetupEmail,
  accountInviteService,
  strapiClient: strapiOrganizerClient,
  enqueueCmsAccessEmail,
  enqueueOrganizerRejectedEmail,
  appUrl: env.APP_URL,
});
