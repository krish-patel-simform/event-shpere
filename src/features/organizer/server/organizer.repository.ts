import "server-only";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  authTokensTable,
  organizerProfilesTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";

/** Postgres "unique_violation". Drizzle wraps the driver error in DrizzleQueryError.cause. */
function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505"
  );
}

export type NewOrganizerAccount = {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  organizationWebsite: string | null;
  setupToken: { tokenHash: string; expiresAt: Date };
};

export const organizerRepository = {
  /**
   * Creates the whole organizer account in ONE transaction: user (pending, no password),
   * its single `organizer` role, the organizer profile, and the set-password token.
   * If any insert fails, none of them are kept.
   */
  async createOrganizerAccount(input: NewOrganizerAccount) {
    try {
      const row = await db.transaction(async (tx) => {
        const [role] = await tx
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(eq(rolesTable.role, "organizer"));
        if (!role) throw new Error('Role "organizer" is missing; run the seed');

        const [user] = await tx
          .insert(usersTable)
          .values({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            status: "pending",
          })
          .returning();

        await tx.insert(userRolesTable).values({ userId: user.id, roleId: role.id });

        const [profile] = await tx
          .insert(organizerProfilesTable)
          .values({
            userId: user.id,
            organizationName: input.organizationName,
            organizationWebsite: input.organizationWebsite,
          })
          .returning();

        await tx.insert(authTokensTable).values({
          userId: user.id,
          type: "account_setup",
          tokenHash: input.setupToken.tokenHash,
          expiresAt: input.setupToken.expiresAt,
        });

        return { user, profile };
      });
      return { ok: true as const, ...row };
    } catch (error) {
      // The only unique value a new account can clash on is the email.
      if (isUniqueViolation(error)) return { ok: false as const, reason: "EMAIL_TAKEN" as const };
      throw error;
    }
  },
};

export type OrganizerRepository = typeof organizerRepository;
