import "server-only";
import { env } from "../../../config/env";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import { ConflictError, NotFoundError } from "../../../core/http/errors";
import type { PageMeta } from "../../../core/http/response";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../../auth";
import { createAccountSetupToken } from "../../auth/server";
import { enqueueAccountSetupEmail } from "../../email/server";
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
    "createOrganizerAccount" | "listOrganizers" | "verifyOrganizer"
  >;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  appUrl: string;
};

export function createOrganizerService(deps: OrganizerServiceDeps) {
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
     */
    async verifyOrganizer(
      organizerId: string,
      verifierId: string,
    ): Promise<VerifyOrganizerResponseDto> {
      const row = await deps.organizerRepository.verifyOrganizer({
        organizerId,
        verifierId,
      });
      if (!row) throw new NotFoundError("Organizer not found");

      // After the update both must be set. If not, the data is broken: fail loudly (500).
      if (!row.verifiedAt || !row.verifiedBy) {
        throw new Error(`Organizer ${organizerId} has no verifier after verifying`);
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
  appUrl: env.APP_URL,
});
