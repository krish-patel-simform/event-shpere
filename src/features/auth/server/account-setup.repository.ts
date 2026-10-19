import "server-only";
import { and, eq, gt, isNull, TransactionRollbackError } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { authTokensTable, usersTable } from "../../../db/schemas";

export const accountSetupRepository = {
  /**
   * Uses the setup link and activates the account, all in one transaction.
   * Returns false (and changes nothing) when the token is unknown, already used, expired,
   * or the account is no longer pending.
   */
  async completeSetup(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        // Marks the token used in the same statement that checks it: two clicks at the
        // same moment cannot both pass (only one UPDATE matches `used_at IS NULL`).
        const [token] = await tx
          .update(authTokensTable)
          .set({ usedAt: input.now })
          .where(
            and(
              eq(authTokensTable.tokenHash, input.tokenHash),
              eq(authTokensTable.type, "account_setup"),
              isNull(authTokensTable.usedAt),
              gt(authTokensTable.expiresAt, input.now),
            ),
          )
          .returning({ userId: authTokensTable.userId });
        if (!token) return false;

        // Hash + active in ONE update: the users_active_has_password check requires both.
        // The link proved the inbox belongs to them, so the email counts as verified.
        const [user] = await tx
          .update(usersTable)
          .set({
            passwordHash: input.passwordHash,
            status: "active",
            emailVerifiedAt: input.now,
          })
          .where(
            and(
              eq(usersTable.id, token.userId),
              eq(usersTable.status, "pending"),
            ),
          )
          .returning({ id: usersTable.id });
        if (!user) tx.rollback(); // undo the token update too

        // once authToken makr as the used so find all related user authtoken taht i not used so mark those as used for consistency s
        // if user sedn mail twice and set up using latest email then again try to setup using old mail so thatd denield because we uodate all authToken related to user with coount setpu
        // Any other unused setup link for this account stops working.
        await tx
          .update(authTokensTable)
          .set({ usedAt: input.now })
          .where(
            and(
              eq(authTokensTable.userId, token.userId),
              eq(authTokensTable.type, "account_setup"),
              isNull(authTokensTable.usedAt),
            ),
          );
        return true;
      });
    } catch (error) {
      if (error instanceof TransactionRollbackError) return false;
      throw error;
    }
  },
};

export type AccountSetupRepository = typeof accountSetupRepository;
