import "server-only";
import { env } from "../../../config/env";
import {
  hashPassword,
  verifyPassword,
} from "../../../core/auth/server/password";
import {
  generateOpaqueToken,
  hashToken,
} from "../../../core/auth/server/tokens";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../core/http/errors";
import { sendPasswordResetEmail } from "../../email/server";
import {
  PASSWORD_RESET_ADMIN_COOLDOWN_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
} from "../constants";
import type {
  ForgotPasswordBody,
  ResetPasswordBody,
  SendResetLinkResponseDto,
} from "../schemas/auth.schemas";
import {
  passwordResetRepository,
  type PasswordResetRepository,
} from "./password-reset.repository";

// One answer for unknown, used and expired links: never reveal which.
const INVALID_LINK = "This link is invalid or has expired";
const ADMIN_RESET_NOT_ALLOWED =
  "Password reset by email is not available for this account";
const SAME_PASSWORD = "Choose a password different from your current one";

export type PasswordResetServiceDeps = {
  passwordResetRepository: Pick<
    PasswordResetRepository,
    | "findActiveUserByEmail"
    | "findUserById"
    | "findLastResetTokenCreatedAt"
    | "createResetToken"
    | "findValidResetToken"
    | "resetPassword"
  >;
  hashPassword: typeof hashPassword;
  verifyPassword: typeof verifyPassword;
  sendPasswordResetEmail: typeof sendPasswordResetEmail;
  tokenTtlMinutes: number;
  /** Minimum wait between two links an admin sends to the same person. */
  adminCooldownSeconds: number;
  /** Base URL for the reset link in the email. */
  appUrl: string;
};

type ResetRecipient = { id: string; email: string; firstName: string };

// A factory with injected dependencies, so tests can pass fakes instead of the real DB.
export function createPasswordResetService(deps: PasswordResetServiceDeps) {
  /**
   * The one place a reset link is made, for "forgot password" and for an admin sending one. The
   * old links of the account stop working. The raw token exists only here and in the email; the
   * database gets its hash.
   */
  async function createLink(user: ResetRecipient, now: Date) {
    const token = generateOpaqueToken();
    const expiresAt = new Date(
      now.getTime() + deps.tokenTtlMinutes * 60 * 1000,
    );
    await deps.passwordResetRepository.createResetToken({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      now,
    });
    return { token, expiresAt };
  }

  /** The one reset email. It throws if sending fails; each caller decides what that means. */
  function sendLink(user: ResetRecipient, token: string, sentByAdmin: boolean) {
    return deps.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl: `${deps.appUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInMinutes: deps.tokenTtlMinutes,
      // Only set for an admin's link, so the person's own email is built exactly as before.
      ...(sentByAdmin ? { sentByAdmin: true } : {}),
    });
  }

  return {
    /**
     * AUTH-6: emails a reset link to an ACTIVE account with this email.
     * Resolves the same way, found or not: the caller (and so the person typing the email)
     * must never be able to tell whether an account exists. The one exception is an ADMIN
     * account, which throws a ValidationError (400): admins never reset by email link.
     */
    async requestReset(
      input: ForgotPasswordBody,
      now = new Date(),
    ): Promise<void> {
      const user = await deps.passwordResetRepository.findActiveUserByEmail(
        input.email,
      );
      if (!user) return;

      // Admin passwords are never reset by email link. Checked before any token is created.
      if (user.role === "admin") {
        throw new ValidationError(ADMIN_RESET_NOT_ALLOWED, {
          fieldErrors: { email: [ADMIN_RESET_NOT_ALLOWED] },
        });
      }

      const { token } = await createLink(user, now);

      // Sent only after the token is committed (a rolled-back token must never get an email).
      // A sending failure must not change the answer (it would reveal that the account
      // exists): log the message, never the link.
      try {
        await sendLink(user, token, false);
      } catch (error) {
        console.error(
          `[auth] password reset email not sent for user ${user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    },

    /**
     * ADM-9: an admin sends a reset link to a user, who then sets a new password on the same
     * /reset-password page as after "forgot password" (same token type, same email). The caller
     * has permission already; what is checked here is whether THIS account can be reset:
     * - not an administrator (admin passwords are never reset by email link, same rule as
     *   "forgot password");
     * - active: a pending account has no password yet and needs the set-password invite instead,
     *   a suspended one cannot be used at all;
     * - not another link in the last minute (stops inbox spam).
     * Unlike "forgot password" the caller is a signed-in admin, so these are told apart, and a
     * failed email is reported (the admin can send it again) instead of hidden.
     */
    async sendResetLinkToUser(
      userId: string,
      now = new Date(),
    ): Promise<SendResetLinkResponseDto> {
      const user = await deps.passwordResetRepository.findUserById(userId);
      if (!user) throw new NotFoundError("User not found");

      if (user.role === "admin") {
        throw new ForbiddenError(ADMIN_RESET_NOT_ALLOWED, "CANNOT_RESET_ADMIN");
      }
      if (user.status === "pending") {
        throw new ConflictError(
          "ACCOUNT_PENDING",
          "This person has not set up their account yet. Send them the set-password invite instead.",
        );
      }
      if (user.status === "suspended") {
        throw new ConflictError(
          "ACCOUNT_SUSPENDED",
          "This account is suspended, so no reset link can be sent",
        );
      }

      const last =
        await deps.passwordResetRepository.findLastResetTokenCreatedAt(user.id);
      if (last) {
        const waitMs =
          last.getTime() + deps.adminCooldownSeconds * 1000 - now.getTime();
        if (waitMs > 0) {
          throw new RateLimitError(
            `A reset link was sent moments ago. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
          );
        }
      }

      const { token, expiresAt } = await createLink(user, now);

      // After the commit, like "forgot password". The link is saved even if sending fails, but
      // it is of no use to anyone: tell the admin, who can send again after the cooldown.
      try {
        await sendLink(user, token, true);
      } catch (error) {
        // Message only: never the link.
        console.error(
          `[auth] admin password reset email not sent for user ${user.id}:`,
          error instanceof Error ? error.message : error,
        );
        throw new ServiceUnavailableError(
          "EMAIL_NOT_SENT",
          "The email could not be sent. Try again in a minute.",
        );
      }

      return { expiresAt: expiresAt.toISOString() };
    },

    /**
     * AUTH-7: sets a new password from an emailed reset link. In order:
     * 1. the link is valid (read-only, so a rejected password does not use it up);
     * 2. the new password is not the current one;
     * 3. the new password is hashed (slow, so before the transaction);
     * 4. one transaction: use the link, save the password, revoke every session.
     */
    async resetPassword(
      input: ResetPasswordBody,
      now = new Date(),
    ): Promise<void> {
      const tokenHash = hashToken(input.token);

      const owner = await deps.passwordResetRepository.findValidResetToken({
        tokenHash,
        now,
      });
      if (!owner) {
        throw new ValidationError(INVALID_LINK, {
          fieldErrors: { token: [INVALID_LINK] },
        });
      }

      // Hashes are salted, so they cannot be compared: verify the plain new password against
      // the current hash. An account without a password has nothing to be the same as.
      if (
        owner.passwordHash &&
        (await deps.verifyPassword(owner.passwordHash, input.password))
      ) {
        throw new ValidationError(SAME_PASSWORD, {
          fieldErrors: { password: [SAME_PASSWORD] },
        });
      }

      const newPasswordHash = await deps.hashPassword(input.password);

      // False = the link was used or expired since step 1, or the account is no longer active.
      const done = await deps.passwordResetRepository.resetPassword({
        tokenHash,
        newPasswordHash,
        now,
      });
      if (!done) {
        throw new ValidationError(INVALID_LINK, {
          fieldErrors: { token: [INVALID_LINK] },
        });
      }
    },
  };
}

export const passwordResetService = createPasswordResetService({
  passwordResetRepository,
  hashPassword,
  verifyPassword,
  sendPasswordResetEmail,
  tokenTtlMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
  adminCooldownSeconds: PASSWORD_RESET_ADMIN_COOLDOWN_SECONDS,
  appUrl: env.APP_URL,
});
