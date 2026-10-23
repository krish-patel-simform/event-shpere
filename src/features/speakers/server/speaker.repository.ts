import "server-only";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  authTokensTable,
  rolesTable,
  speakersProfilesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";

/**
 * Name of the unique constraint a Postgres "unique_violation" (23505) hit, else null.
 * Drizzle wraps the driver error in DrizzleQueryError.cause.
 */
function violatedUniqueConstraint(error: unknown): string | null {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    typeof cause.constraint === "string"
  ) {
    return cause.constraint;
  }
  return null;
}

export type NewSpeakerAccount = {
  firstName: string;
  lastName: string;
  email: string;
  slug: string;
  /** Strapi documentId of the draft Speaker entry, created before this insert. */
  cmsSpeakerId: string;
  /** users.id of the organizer/admin who invited the speaker (from the access token). */
  createdBy: string;
  setupToken: { tokenHash: string; expiresAt: Date };
};

export const speakerRepository = {
  /** True when any account (any role) already uses this email. */
  async emailExists(email: string): Promise<boolean> {
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return row !== undefined;
  },

  /**
   * Creates the whole speaker account in ONE transaction: user (pending, no password),
   * its `speaker` role, the speaker profile, and the set-password token.
   * If any insert fails, none of them are kept.
   */
  async createSpeaker(input: NewSpeakerAccount) {
    try {
      const row = await db.transaction(async (tx) => {
        const [role] = await tx
          .select({ id: rolesTable.id })
          .from(rolesTable)
          .where(eq(rolesTable.role, "speaker"));
        if (!role) throw new Error('Role "speaker" is missing; run the seed');

        const [user] = await tx
          .insert(usersTable)
          .values({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            status: "pending",
          })
          .returning();

        await tx
          .insert(userRolesTable)
          .values({ userId: user.id, roleId: role.id });

        const [profile] = await tx
          .insert(speakersProfilesTable)
          .values({
            userId: user.id,
            slug: input.slug,
            cmsSpeakerId: input.cmsSpeakerId,
            createdBy: input.createdBy,
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
      // Two invites for the same email at once: emailExists passed for both, the DB stops one.
      // Other unique clashes (slug, cms id) are not the caller's fault: let them be a 500.
      if (violatedUniqueConstraint(error) === "users_email_unique")
        return { ok: false as const, reason: "EMAIL_TAKEN" as const };
      throw error;
    }
  },
};

export type SpeakerRepository = typeof speakerRepository;
