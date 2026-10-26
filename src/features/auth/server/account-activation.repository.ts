import "server-only";
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  TransactionRollbackError,
} from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  authTokensTable,
  authTokenTypeEnum,
  usersTable,
} from "../../../db/schemas";

// The transaction handle Drizzle passes to db.transaction's callback. The building blocks
// below take it, so one flow can combine several of them in ONE transaction.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type AuthTokenType = (typeof authTokenTypeEnum.enumValues)[number];

// ---------- building blocks, shared by every emailed-token flow ----------

/**
 * Marks a valid token used and returns its user id; null if the token is unknown, of
 * another type, already used or expired. Check and use happen in ONE update, so two
 * requests at the same moment cannot both pass (only one UPDATE matches `used_at IS NULL`).
 */
export async function consumeToken(
  tx: Tx,
  input: { tokenHash: string; type: AuthTokenType; now: Date },
): Promise<string | null> {
  const [token] = await tx
    .update(authTokensTable)
    .set({ usedAt: input.now })
    .where(
      and(
        eq(authTokensTable.tokenHash, input.tokenHash),
        eq(authTokensTable.type, input.type),
        isNull(authTokensTable.usedAt),
        gt(authTokensTable.expiresAt, input.now),
      ),
    )
    .returning({ userId: authTokensTable.userId });
  return token?.userId ?? null;
}

/**
 * Every other unused token of this type for the user stops working. Example: a link or
 * code was sent twice and the newest one was used, so the older one must fail now.
 */
export async function invalidateUserTokens(
  tx: Tx,
  input: { userId: string; type: AuthTokenType; now: Date },
): Promise<void> {
  await tx
    .update(authTokensTable)
    .set({ usedAt: input.now })
    .where(
      and(
        eq(authTokensTable.userId, input.userId),
        eq(authTokensTable.type, input.type),
        isNull(authTokensTable.usedAt),
      ),
    );
}

/**
 * pending → active, with the email marked verified (the person proved the inbox is theirs).
 * Pass `passwordHash` when this step also sets the first password (account setup).
 * Returns false when the user is not pending (already active, suspended, or gone).
 */
async function activatePendingUser(
  tx: Tx,
  input: { userId: string; now: Date; passwordHash?: string },
): Promise<boolean> {
  const [user] = await tx
    .update(usersTable)
    .set({
      status: "active",
      emailVerifiedAt: input.now,
      // Hash + active in ONE update: the users_active_has_password check requires both.
      ...(input.passwordHash !== undefined && {
        passwordHash: input.passwordHash,
      }),
    })
    .where(
      and(eq(usersTable.id, input.userId), eq(usersTable.status, "pending")),
    )
    .returning({ id: usersTable.id });
  return user !== undefined;
}

/**
 * The whole "use an emailed token" flow, the same for every token type:
 * consume it → activate the user → invalidate the user's other tokens of that type.
 * Returns false (and changes nothing) when the token is unknown, used, expired, or the
 * account is no longer pending.
 */
async function activateWithToken(input: {
  tokenHash: string;
  type: AuthTokenType;
  now: Date;
  passwordHash?: string;
}): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      const userId = await consumeToken(tx, input);
      if (!userId) return false;

      const activated = await activatePendingUser(tx, {
        userId,
        now: input.now,
        passwordHash: input.passwordHash,
      });
      if (!activated) tx.rollback(); // undo the token use too

      await invalidateUserTokens(tx, {
        userId,
        type: input.type,
        now: input.now,
      });
      return true;
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return false;
    throw error;
  }
}

// ---------- the two ways an account becomes active ----------

export const accountActivationRepository = {
  /**
   * Read-only check of an emailed token: who it belongs to, if it is still valid (right
   * type, unused, unexpired). Nothing is changed, so a wrong 6-digit code does not burn the
   * link: the token is only consumed later, by verifyEmail, once the code is correct.
   */
  async findValidToken(input: {
    tokenHash: string;
    type: AuthTokenType;
    now: Date;
  }): Promise<{ userId: string; email: string } | null> {
    const [row] = await db
      .select({ userId: usersTable.id, email: usersTable.email })
      .from(authTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, authTokensTable.userId))
      .where(
        and(
          eq(authTokensTable.tokenHash, input.tokenHash),
          eq(authTokensTable.type, input.type),
          isNull(authTokensTable.usedAt),
          gt(authTokensTable.expiresAt, input.now),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** Account created by an admin: the emailed setup link sets the first password. */
  completeSetup(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    return activateWithToken({ ...input, type: "account_setup" });
  },

  /**
   * Self-registered account: the verify-link token. Call this only AFTER the 6-digit code
   * was accepted (Redis); this consumes the token and activates the account.
   */
  verifyEmail(input: { tokenHash: string; now: Date }): Promise<boolean> {
    return activateWithToken({ ...input, type: "email_verify" });
  },

  /**
   * Re-invite (ADM-6): for a PENDING account, replaces its set-password link in ONE
   * transaction, so the new email carries the only valid link. The user row is locked
   * (FOR UPDATE): two resends at the same moment run one after the other, so only one new
   * link survives and the second one sees the cooldown.
   */
  async reissueSetupToken(input: {
    userId: string;
    setupToken: { tokenHash: string; expiresAt: Date };
    now: Date;
    cooldownMs: number;
  }) {
    return db.transaction(async (tx) => {
      // Only what the email needs, never the whole row (it holds the password hash).
      const [user] = await tx
        .select({
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          status: usersTable.status,
        })
        .from(usersTable)
        .where(eq(usersTable.id, input.userId))
        .for("update");
      if (!user) return { ok: false as const, reason: "NOT_FOUND" as const };
      if (user.status === "active") {
        return { ok: false as const, reason: "ALREADY_ACTIVE" as const };
      }
      if (user.status === "suspended") {
        return { ok: false as const, reason: "SUSPENDED" as const };
      }

      const [lastInvite] = await tx
        .select({ createdAt: authTokensTable.createdAt })
        .from(authTokensTable)
        .where(
          and(
            eq(authTokensTable.userId, user.id),
            eq(authTokensTable.type, "account_setup"),
          ),
        )
        .orderBy(desc(authTokensTable.createdAt))
        .limit(1);
      const waitMs = lastInvite
        ? lastInvite.createdAt.getTime() +
          input.cooldownMs -
          input.now.getTime()
        : 0;
      if (waitMs > 0) {
        return {
          ok: false as const,
          reason: "TOO_SOON" as const,
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        };
      }

      await invalidateUserTokens(tx, {
        userId: user.id,
        type: "account_setup",
        now: input.now,
      });
      await tx.insert(authTokensTable).values({
        userId: user.id,
        type: "account_setup",
        tokenHash: input.setupToken.tokenHash,
        expiresAt: input.setupToken.expiresAt,
      });

      return {
        ok: true as const,
        user: { id: user.id, email: user.email, firstName: user.firstName },
      };
    });
  },
};

export type AccountActivationRepository = typeof accountActivationRepository;
