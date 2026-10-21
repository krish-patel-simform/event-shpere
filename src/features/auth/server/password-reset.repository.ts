import "server-only";
import { and, eq, gt, isNull, TransactionRollbackError } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  authSessionsTable,
  authTokensTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";
import {
  consumeToken,
  invalidateUserTokens,
} from "./account-activation.repository";

type ResetPasswordInput = {
  tokenHash: string;
  newPasswordHash: string;
  now: Date;
};

type RoleName = (typeof rolesTable.$inferSelect)["role"];

export const passwordResetRepository = {
  async findActiveUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    role: RoleName | null;
  } | null> {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        role: rolesTable.role,
      })
      .from(usersTable)
      // leftJoin: an account with no role row must still be found (role = null), not vanish.
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(and(eq(usersTable.email, email), eq(usersTable.status, "active")))
      .limit(1);
    return user ?? null;
  },

  async createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await invalidateUserTokens(tx, {
        userId: input.userId,
        type: "password_reset",
        now: input.now,
      });
      await tx.insert(authTokensTable).values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        type: "password_reset",
        expiresAt: input.expiresAt,
      });
    });
  },

  /**
   * Read-only check of a reset link: whose it is, and that account's current password hash, if
   * the link is still valid (right type, unused, unexpired). Nothing is changed, so a rejected
   * new password does not use up the link. The hash is for the service's "same as the current
   * password?" check only: it must never be returned by the API or logged.
   */
  async findValidResetToken(input: {
    tokenHash: string;
    now: Date;
  }): Promise<{ userId: string; passwordHash: string | null } | null> {
    const [row] = await db
      .select({ userId: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(authTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, authTokensTable.userId))
      .where(
        and(
          eq(authTokensTable.tokenHash, input.tokenHash),
          eq(authTokensTable.type, "password_reset"),
          isNull(authTokensTable.usedAt),
          gt(authTokensTable.expiresAt, input.now),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async resetPassword(input: ResetPasswordInput): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const userId = await consumeToken(tx, {
          tokenHash: input.tokenHash,
          type: "password_reset",
          now: input.now,
        });
        if (!userId) return false;

        // Every query in here uses `tx`, never `db`: `db` would run outside the transaction.
        const [user] = await tx
          .update(usersTable)
          .set({ passwordHash: input.newPasswordHash })
          .where(
            and(eq(usersTable.id, userId), eq(usersTable.status, "active")),
          )
          .returning({ id: usersTable.id });
        if (!user) tx.rollback(); // undo the token use too

        await invalidateUserTokens(tx, {
          userId,
          type: "password_reset",
          now: input.now,
        });

        // A changed password must end every login, or a stolen session would survive it.
        // The access check and the refresh both look at is_revoked, so both stop working.
        await tx
          .update(authSessionsTable)
          .set({ isRevoked: true })
          .where(eq(authSessionsTable.userId, userId));

        return true;
      });
    } catch (error) {
      if (error instanceof TransactionRollbackError) return false;
      throw error;
    }
  },
};

export type PasswordResetRepository = typeof passwordResetRepository;
