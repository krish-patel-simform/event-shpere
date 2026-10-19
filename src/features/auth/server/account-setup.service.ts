import "server-only";
import { hashPassword } from "../../../core/auth/server/password";
import { generateOpaqueToken, hashToken } from "../../../core/auth/server/tokens";
import { ValidationError } from "../../../core/http/errors";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../constants";
import type { AccountSetupBody } from "../schemas/auth.schemas";
import {
  accountSetupRepository,
  type AccountSetupRepository,
} from "./account-setup.repository";

export type AccountSetupToken = {
  /** Goes in the email link only. Never stored, never returned by the API. */
  token: string;
  /** Goes in auth_tokens.token_hash. */
  tokenHash: string;
  expiresAt: Date;
};

/**
 * A new single-use set-password token. Pure (no DB): the caller stores `tokenHash` in the
 * same transaction that creates the account (organizer now; speakers/users later).
 */
export function createAccountSetupToken(now = new Date()): AccountSetupToken {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ACCOUNT_SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000),
  };
}

type AccountSetupServiceDeps = {
  accountSetupRepository: Pick<AccountSetupRepository, "completeSetup">;
  hashPassword: typeof hashPassword;
};

export function createAccountSetupService(deps: AccountSetupServiceDeps) {
  return {
    /** Sets the first password from an emailed link; the account becomes active. */
    async completeAccountSetup(input: AccountSetupBody): Promise<void> {
      // Hash before the transaction: argon2 is slow, keep the transaction short.
      const passwordHash = await deps.hashPassword(input.password);

      const done = await deps.accountSetupRepository.completeSetup({
        tokenHash: hashToken(input.token),
        passwordHash,
        now: new Date(),
      });

      // One answer for unknown, used and expired links: never reveal which.
      if (!done) {
        throw new ValidationError("This link is invalid or has expired", {
          fieldErrors: { token: ["This link is invalid or has expired"] },
        });
      }
    },
  };
}

export const accountSetupService = createAccountSetupService({
  accountSetupRepository,
  hashPassword,
});
