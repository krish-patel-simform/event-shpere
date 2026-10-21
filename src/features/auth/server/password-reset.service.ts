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
import { ValidationError } from "../../../core/http/errors";
import { sendPasswordResetEmail } from "../../email/server";
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from "../constants";
import type {
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../schemas/auth.schemas";
import {
  passwordResetRepository,
  type PasswordResetRepository,
} from "./password-reset.repository";

// One answer for unknown, used and expired links: never reveal which.
const INVALID_LINK = "This link is invalid or has expired";
const SAME_PASSWORD = "Choose a password different from your current one";

export type PasswordResetServiceDeps = {
  passwordResetRepository: Pick<
    PasswordResetRepository,
    | "findActiveUserByEmail"
    | "createResetToken"
    | "findValidResetToken"
    | "resetPassword"
  >;
  hashPassword: typeof hashPassword;
  verifyPassword: typeof verifyPassword;
  sendPasswordResetEmail: typeof sendPasswordResetEmail;
  tokenTtlMinutes: number;
  /** Base URL for the reset link in the email. */
  appUrl: string;
};

// A factory with injected dependencies, so tests can pass fakes instead of the real DB.
export function createPasswordResetService(deps: PasswordResetServiceDeps) {
  return {
    /**
     * AUTH-6: emails a reset link to an ACTIVE account with this email.
     * Always resolves the same way, found or not: the caller (and so the person typing the
     * email) must never be able to tell whether an account exists.
     */
    async requestReset(
      input: ForgotPasswordBody,
      now = new Date(),
    ): Promise<void> {
      const user = await deps.passwordResetRepository.findActiveUserByEmail(
        input.email,
      );
      if (!user) return;

      // Admin passwords are never reset by email link. Same quiet return as "not found", so the
      // response can't be used to tell who is an admin.
      if (user.role === "admin") return;

      // The raw token exists only here and in the email; the database gets its hash.
      const token = generateOpaqueToken();
      await deps.passwordResetRepository.createResetToken({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + deps.tokenTtlMinutes * 60 * 1000),
        now,
      });

      // Sent only after the token is committed (a rolled-back token must never get an email).
      // A sending failure must not change the answer (it would reveal that the account
      // exists): log the message, never the link.
      try {
        await deps.sendPasswordResetEmail({
          to: user.email,
          firstName: user.firstName,
          resetUrl: `${deps.appUrl}/reset-password?token=${encodeURIComponent(token)}`,
          expiresInMinutes: deps.tokenTtlMinutes,
        });
      } catch (error) {
        console.error(
          `[auth] password reset email not sent for user ${user.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
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
  appUrl: env.APP_URL,
});
