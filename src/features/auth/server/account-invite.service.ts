import "server-only";
import { env } from "../../../config/env";
import {
  ConflictError,
  NotFoundError,
  RateLimitError,
} from "../../../core/http/errors";
import { enqueueAccountSetupEmail } from "../../email/server";
import {
  ACCOUNT_SETUP_RESEND_COOLDOWN_SECONDS,
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
} from "../constants";
import type { ResendInviteResponseDto } from "../schemas/auth.schemas";
import {
  accountActivationRepository,
  type AccountActivationRepository,
} from "./account-activation.repository";
import { createAccountSetupToken } from "./account-activation.service";

export type AccountInviteServiceDeps = {
  accountActivationRepository: Pick<
    AccountActivationRepository,
    "reissueSetupToken"
  >;
  createAccountSetupToken: typeof createAccountSetupToken;
  enqueueAccountSetupEmail: typeof enqueueAccountSetupEmail;
  appUrl: string;
  cooldownSeconds: number;
};

/**
 * Invites for accounts someone else created (speakers, organizers). The same for every role,
 * so the speakers and organizer features call this instead of each building their own.
 */
export function createAccountInviteService(deps: AccountInviteServiceDeps) {
  return {
    /**
     * ADM-6: a new set-password link for a PENDING account. Old links stop working, so the
     * newest email is the only one that works. The caller has already checked permissions
     * and found the user (speaker by slug, organizer by profile id).
     */
    async resendAccountSetup(
      userId: string,
      now = new Date(),
    ): Promise<ResendInviteResponseDto> {
      const setupToken = deps.createAccountSetupToken(now);

      const result = await deps.accountActivationRepository.reissueSetupToken({
        userId,
        setupToken: {
          tokenHash: setupToken.tokenHash,
          expiresAt: setupToken.expiresAt,
        },
        now,
        cooldownMs: deps.cooldownSeconds * 1000,
      });

      if (!result.ok) {
        switch (result.reason) {
          case "NOT_FOUND":
            throw new NotFoundError("Account not found");
          case "ALREADY_ACTIVE":
            throw new ConflictError(
              "ACCOUNT_ALREADY_ACTIVE",
              'This person has already set up their account. They can use "Forgot password" if needed.',
            );
          case "SUSPENDED":
            throw new ConflictError(
              "ACCOUNT_SUSPENDED",
              "This account is suspended, so no invite can be sent",
            );
          case "TOO_SOON":
            throw new RateLimitError(
              `An invite was sent moments ago. Try again in ${result.retryAfterSeconds} seconds.`,
            );
        }
      }

      // Only after the commit: the new link exists. If Redis is down the link is still saved;
      // report it instead of failing, so the caller can try again after the cooldown.
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
          `[auth] invite email not queued for user ${result.user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }

      return {
        setupEmailQueued,
        expiresAt: setupToken.expiresAt.toISOString(),
      };
    },
  };
}

export type AccountInviteService = ReturnType<
  typeof createAccountInviteService
>;

export const accountInviteService = createAccountInviteService({
  accountActivationRepository,
  createAccountSetupToken,
  enqueueAccountSetupEmail,
  appUrl: env.APP_URL,
  cooldownSeconds: ACCOUNT_SETUP_RESEND_COOLDOWN_SECONDS,
});
