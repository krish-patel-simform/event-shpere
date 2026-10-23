import "server-only";
import {
  and,
  count,
  desc,
  DrizzleQueryError,
  eq,
  ilike,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../db/dbClient";
import {
  authTokensTable,
  organizerProfilesTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";
import type { OrganizerSearchField } from "../schemas/organizer.schemas";

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

const verifierTable = alias(usersTable, "verifier");

// ILIKE treats % and _ as wildcards: escape them so searching "50%" means "50%".
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Search field (DB column name) → how to search it. Typed as a Record over the schema's
// whitelist, so adding a field there without a condition here is a compile error.
const searchConditions: Record<OrganizerSearchField, (pattern: string) => SQL> =
  {
    organization_name: (pattern) =>
      ilike(organizerProfilesTable.organizationName, pattern),
  };

export type OrganizerSearch = { field: OrganizerSearchField; value: string };

export type VerifyOrganizerInfo = {
  /** organizer_profiles.id */
  organizerId: string;
  /** users.id of the admin, from the access token (never from the request). */
  verifierId: string;
  /** Strapi admin user id, saved in the same UPDATE as the verification. */
  cmsOrganizerId?: number;
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

        await tx
          .insert(userRolesTable)
          .values({ userId: user.id, roleId: role.id });

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
      if (isUniqueViolation(error))
        return { ok: false as const, reason: "EMAIL_TAKEN" as const };
      throw error;
    }
  },

  /** One page of organizers, newest first, plus the total count for pagination. */
  /** One page of organizers, newest first, optionally searched, plus the matching total. */
  async listOrganizers(params: {
    search?: OrganizerSearch;
    limit: number;
    offset: number;
  }) {
    // Contains-match, case-insensitive. undefined = no filter → all organizers.
    // The value is sent as a bound parameter (never pasted into SQL): no injection.
    const where = params.search
      ? searchConditions[params.search.field](
          `%${escapeLike(params.search.value)}%`,
        )
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: organizerProfilesTable.id,
          organizerFirstName: usersTable.firstName,
          organizerLastName: usersTable.lastName,
          organizationName: organizerProfilesTable.organizationName,
          organizationWebsite: organizerProfilesTable.organizationWebsite,
          verifiedAt: organizerProfilesTable.verifiedAt,
          // Joined in SQL: "Ada Admin". `||` with NULL gives NULL, so an unverified
          // organizer (no verifier row from the left join) gets null.
          verifiedBy: sql<
            string | null
          >`${verifierTable.firstName} || ' ' || ${verifierTable.lastName}`,
        })
        .from(organizerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
        // LEFT join: unverified organizers have no verifier but must stay in the list.
        .leftJoin(
          verifierTable,
          eq(verifierTable.id, organizerProfilesTable.verifiedBy),
        )
        .where(where)
        // id breaks ties, so paging never shows a row twice or skips one.
        .orderBy(
          desc(organizerProfilesTable.createdAt),
          desc(organizerProfilesTable.id),
        )
        .limit(params.limit)
        .offset(params.offset),
      // Same join + same where as the page, so `total` counts exactly the matches
      // (the users join is there for future search fields on users, e.g. email).
      db
        .select({ total: count() })
        .from(organizerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
        .where(where),
    ]);
    return { rows, total };
  },

  /**
   * Marks the organizer verified, then reads it back with both names (organizer and the
   * verifying admin). Returns null when the organizer does not exist.
   * Already verified → nothing is overwritten: the first verifier and time are kept.
   * `justVerified` is true only for the call that actually verified it, so one-time
   * follow-ups (the CMS access email) happen once even if two Verify clicks race.
   */
  async verifyOrganizer(input: VerifyOrganizerInfo) {
    return db.transaction(async (tx) => {
      // `verified_at IS NULL`: only an unverified organizer is updated (idempotent).
      // verifiedAt and verifiedBy are set together (the table's check constraint needs both).
      const updated = await tx
        .update(organizerProfilesTable)
        .set({
          verifiedAt: new Date(),
          verifiedBy: input.verifierId,
          cmsOrganizerId: input.cmsOrganizerId,
        })
        .where(
          and(
            eq(organizerProfilesTable.id, input.organizerId),
            isNull(organizerProfilesTable.verifiedAt),
          ),
        )
        .returning({ id: organizerProfilesTable.id });

      // .returning() could only give organizer_profiles columns; the names live in users.
      const [row] = await tx
        .select({
          organizerId: organizerProfilesTable.id,
          organizationName: organizerProfilesTable.organizationName,
          organizerFirstName: usersTable.firstName,
          organizerLastName: usersTable.lastName,
          verifiedAt: organizerProfilesTable.verifiedAt,
          verifiedBy: sql<
            string | null
          >`${verifierTable.firstName} || ' ' || ${verifierTable.lastName}`,
        })
        .from(organizerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
        .leftJoin(
          verifierTable,
          eq(verifierTable.id, organizerProfilesTable.verifiedBy),
        )
        .where(eq(organizerProfilesTable.id, input.organizerId));

      return row ? { ...row, justVerified: updated.length > 0 } : null;
    });
  },

  /** What verifying needs before the Strapi call. null = no such organizer. */
  async findForVerify(organizerId: string) {
    const [row] = await db
      .select({
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        verifiedAt: organizerProfilesTable.verifiedAt,
      })
      .from(organizerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
      .where(eq(organizerProfilesTable.id, organizerId));
    return row ?? null;
  },
};

export type OrganizerRepository = typeof organizerRepository;
