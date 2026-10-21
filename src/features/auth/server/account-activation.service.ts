import "server-only";
import { hashPassword } from "../../../core/auth/server/password";
import {
  generateOpaqueToken,
  hashToken,
} from "../../../core/auth/server/tokens";
import { ValidationError } from "../../../core/http/errors";
import {
  emailOtpStore,
  hashEmailOtp,
  type EmailOtpStore,
} from "../../email/server";
import {
  ACCOUNT_SETUP_TOKEN_TTL_HOURS,
  EMAIL_VERIFY_TOKEN_TTL_MINUTES,
} from "../constants";
import type {
  AccountSetupBody,
  VerifyEmailBody,
} from "../schemas/auth.schemas";
import {
  accountActivationRepository,
  type AccountActivationRepository,
} from "./account-activation.repository";

/** A single-use token for an emailed link (account setup or verify-email). */
export type EmailedToken = {
  /** Goes in the email link only. Never stored, never returned by the API. */
  token: string;
  /** Goes in auth_tokens.token_hash. */
  tokenHash: string;
  expiresAt: Date;
};
export type AccountSetupToken = EmailedToken;

// Pure (no DB): the caller stores `tokenHash` in the same transaction that creates the account.
function createEmailedToken(ttlMs: number, now: Date): EmailedToken {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

/** Set-password link for an account created by an admin (organizer now; speakers/users later). */
export function createAccountSetupToken(now = new Date()): EmailedToken {
  return createEmailedToken(
    ACCOUNT_SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    now,
  );
}

/** Verify-email link for a self-registered account; the 6-digit code is checked separately in Redis. */
export function createEmailVerifyToken(now = new Date()): EmailedToken {
  return createEmailedToken(EMAIL_VERIFY_TOKEN_TTL_MINUTES * 60 * 1000, now);
}

const INVALID_LINK = "This link is invalid or has expired";
const INVALID_CODE = "This code is invalid or has expired";

export type AccountActivationServiceDeps = {
  accountActivationRepository: Pick<
    AccountActivationRepository,
    "findValidToken" | "completeSetup" | "verifyEmail"
  >;
  hashPassword: typeof hashPassword;
  hashEmailOtp: typeof hashEmailOtp;
  emailOtpStore: Pick<EmailOtpStore, "verify">;
};

/** Every way a pending account becomes active: setup link (admin-created) or email code (self-signup). */
export function createAccountActivationService(
  deps: AccountActivationServiceDeps,
) {
  return {
    /** Sets the first password from an emailed link; the account becomes active. */
    async completeAccountSetup(input: AccountSetupBody): Promise<void> {
      // Hash before the transaction: argon2 is slow, keep the transaction short.
      const passwordHash = await deps.hashPassword(input.password);

      const done = await deps.accountActivationRepository.completeSetup({
        tokenHash: hashToken(input.token),
        passwordHash,
        now: new Date(),
      });

      // One answer for unknown, used and expired links: never reveal which.
      if (!done) {
        throw new ValidationError(INVALID_LINK, {
          fieldErrors: { token: [INVALID_LINK] },
        });
      }
    },

    /**
     * Verify-email page: link token + 6-digit code. Two separate checks, then the shared
     * token flow: 1. token valid (DB) → 2. code correct (Redis) → 3. consume token,
     * activate user, invalidate the user's other verify tokens (DB, one transaction).
     */
    async verifyEmail(input: VerifyEmailBody): Promise<void> {
      const now = new Date();
      const tokenHash = hashToken(input.token);

      // 1. Which account is this? Read-only: a wrong code below must not burn the link.
      const owner = await deps.accountActivationRepository.findValidToken({
        tokenHash,
        type: "email_verify",
        now,
      });
      if (!owner) {
        throw new ValidationError(INVALID_LINK, {
          fieldErrors: { token: [INVALID_LINK] },
        });
      }

      // 2. The code, checked in Redis against the hash saved at signup. A hash cannot be
      // decoded: hash what the user typed the same way and compare. Wrong tries are
      // counted there; after too many the code is deleted and a new one is needed.
      const codeOk = await deps.emailOtpStore.verify(
        owner.email,
        deps.hashEmailOtp(owner.email, input.otp),
      );
      if (!codeOk) {
        throw new ValidationError(INVALID_CODE, {
          fieldErrors: { otp: [INVALID_CODE] },
        });
      }

      // 3. Only now: consume the token → activate the user → invalidate other tokens.
      // False here = the token was used or expired between step 1 and now.
      const done = await deps.accountActivationRepository.verifyEmail({
        tokenHash,
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

export const accountActivationService = createAccountActivationService({
  accountActivationRepository,
  hashPassword,
  hashEmailOtp,
  emailOtpStore,
});
