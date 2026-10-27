import "server-only";
import {
  and,
  asc,
  count,
  desc,
  DrizzleQueryError,
  eq,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../db/dbClient";
import { escapeLike } from "../../../db/escape-like";
import {
  authTokensTable,
  organizerProfilesTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";
import type {
  OrganizerSort,
  OrganizerVerificationFilter,
} from "../schemas/organizer.schemas";

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
const rejecterTable = alias(usersTable, "rejecter");

// What the search box matches: the organisation, the applicant (first, last or "first last") or
// the email. `pattern` is already escaped and wrapped in % by the caller.
function searchCondition(pattern: string): SQL | undefined {
  return or(
    ilike(organizerProfilesTable.organizationName, pattern),
    ilike(usersTable.firstName, pattern),
    ilike(usersTable.lastName, pattern),
    ilike(
      sql`(${usersTable.firstName} || ' ' || ${usersTable.lastName})`,
      pattern,
    ),
    ilike(usersTable.email, pattern),
  );
}

// Each list is ordered by the date that matters in it: when the application came in (waiting
// list, or no list chosen), when it was approved, when it was rejected. Typed as a Record over
// the schema's filter list, so a new list without a date is a compile error.
const sortColumns: Record<
  OrganizerVerificationFilter,
  | typeof organizerProfilesTable.createdAt
  | typeof organizerProfilesTable.verifiedAt
  | typeof organizerProfilesTable.rejectedAt
> = {
  pending: organizerProfilesTable.createdAt,
  verified: organizerProfilesTable.verifiedAt,
  rejected: organizerProfilesTable.rejectedAt,
};

// Typed as a Record over the schema's filter list, like sortColumns.
// Pending = neither decision yet: a rejected applicant is not in the approval queue.
const verificationConditions: Record<
  OrganizerVerificationFilter,
  SQL | undefined
> = {
  pending: and(
    isNull(organizerProfilesTable.verifiedAt),
    isNull(organizerProfilesTable.rejectedAt),
  ),
  verified: isNotNull(organizerProfilesTable.verifiedAt),
  rejected: isNotNull(organizerProfilesTable.rejectedAt),
};

export type VerifyOrganizerInfo = {
  /** organizer_profiles.id */
  organizerId: string;
  /** users.id of the admin, from the access token (never from the request). */
  verifierId: string;
  /** Strapi admin user id, saved in the same UPDATE as the verification. */
  cmsOrganizerId?: number;
};

export type RejectOrganizerInfo = {
  /** organizer_profiles.id */
  organizerId: string;
  /** users.id of the admin, from the access token (never from the request). */
  rejecterId: string;
  reason: string;
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

  /**
   * One page of organizers, newest first, optionally searched and/or filtered by
   * verification, plus the matching total.
   */
  async listOrganizers(params: {
    search?: string;
    verification?: OrganizerVerificationFilter;
    /** true = only applicants who confirmed their email, false = only those who did not. */
    emailVerified?: boolean;
    sort: OrganizerSort;
    limit: number;
    offset: number;
  }) {
    // Contains-match, case-insensitive. undefined = no filter → all organizers.
    // The value is sent as a bound parameter (never pasted into SQL): no injection.
    const searchFilter = params.search
      ? searchCondition(`%${escapeLike(params.search)}%`)
      : undefined;
    const verificationCondition = params.verification
      ? verificationConditions[params.verification]
      : undefined;
    const emailCondition =
      params.emailVerified === undefined
        ? undefined
        : params.emailVerified
          ? isNotNull(usersTable.emailVerifiedAt)
          : isNull(usersTable.emailVerifiedAt);
    // and() skips undefined parts; with none it is undefined = no WHERE.
    const where = and(searchFilter, verificationCondition, emailCondition);

    const dateColumn = sortColumns[params.verification ?? "pending"];
    const direction = params.sort === "oldest" ? asc : desc;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: organizerProfilesTable.id,
          organizerFirstName: usersTable.firstName,
          organizerLastName: usersTable.lastName,
          email: usersTable.email,
          emailVerifiedAt: usersTable.emailVerifiedAt,
          accountStatus: usersTable.status,
          organizationName: organizerProfilesTable.organizationName,
          organizationWebsite: organizerProfilesTable.organizationWebsite,
          appliedAt: organizerProfilesTable.createdAt,
          verifiedAt: organizerProfilesTable.verifiedAt,
          // Joined in SQL: "Ada Admin". `||` with NULL gives NULL, so an unverified
          // organizer (no verifier row from the left join) gets null.
          verifiedBy: sql<
            string | null
          >`${verifierTable.firstName} || ' ' || ${verifierTable.lastName}`,
          rejectedAt: organizerProfilesTable.rejectedAt,
          rejectionReason: organizerProfilesTable.rejectionReason,
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
        .orderBy(direction(dateColumn), direction(organizerProfilesTable.id))
        .limit(params.limit)
        .offset(params.offset),
      // Same join + same where as the page, so `total` counts exactly the matches
      // (the users join is needed: search and the email filter use users columns).
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
   * A rejected organizer is never updated (rejected is final): `rejectedAt` tells the caller.
   */
  async verifyOrganizer(input: VerifyOrganizerInfo) {
    return db.transaction(async (tx) => {
      // `verified_at IS NULL`: only an unverified organizer is updated (idempotent).
      // `rejected_at IS NULL`: a reject that won a race is not overwritten.
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
            isNull(organizerProfilesTable.rejectedAt),
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
          rejectedAt: organizerProfilesTable.rejectedAt,
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

  /**
   * Rejects a pending applicant with the admin's reason, then reads it back with the names and
   * email (for the response and the rejection email). The account is kept: the applicant can
   * still log in and see the reason. Returns null when the organizer does not exist.
   * Only a pending organizer is updated, in one conditional UPDATE (no race with Verify):
   * `justRejected` is false when it was already verified or rejected, and the read-back row
   * tells which, so the first rejection's reason is never overwritten.
   */
  async rejectPendingOrganizer(input: RejectOrganizerInfo) {
    return db.transaction(async (tx) => {
      // rejectedAt and rejectedBy are set together (the table's check constraints need both).
      const updated = await tx
        .update(organizerProfilesTable)
        .set({
          rejectedAt: new Date(),
          rejectedBy: input.rejecterId,
          rejectionReason: input.reason,
        })
        .where(
          and(
            eq(organizerProfilesTable.id, input.organizerId),
            isNull(organizerProfilesTable.verifiedAt),
            isNull(organizerProfilesTable.rejectedAt),
          ),
        )
        .returning({ id: organizerProfilesTable.id });

      const [row] = await tx
        .select({
          organizerId: organizerProfilesTable.id,
          organizationName: organizerProfilesTable.organizationName,
          organizerFirstName: usersTable.firstName,
          organizerLastName: usersTable.lastName,
          email: usersTable.email,
          verifiedAt: organizerProfilesTable.verifiedAt,
          rejectedAt: organizerProfilesTable.rejectedAt,
          rejectionReason: organizerProfilesTable.rejectionReason,
          rejectedBy: sql<
            string | null
          >`${rejecterTable.firstName} || ' ' || ${rejecterTable.lastName}`,
        })
        .from(organizerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
        .leftJoin(
          rejecterTable,
          eq(rejecterTable.id, organizerProfilesTable.rejectedBy),
        )
        .where(eq(organizerProfilesTable.id, input.organizerId));

      return row ? { ...row, justRejected: updated.length > 0 } : null;
    });
  },

  /**
   * Reopens a rejected application: the three rejection columns go back to NULL together (the
   * check constraints need all three), so the applicant is pending again. Only a rejected
   * organizer is updated, in one conditional UPDATE: `justReopened` is false when it was not
   * rejected (already pending, reopened by another click, or verified). The earlier rejection
   * (who, when, why) is not kept. Returns null when the organizer does not exist.
   */
  async reopenRejectedOrganizer(organizerId: string) {
    return db.transaction(async (tx) => {
      const updated = await tx
        .update(organizerProfilesTable)
        .set({ rejectedAt: null, rejectedBy: null, rejectionReason: null })
        .where(
          and(
            eq(organizerProfilesTable.id, organizerId),
            isNotNull(organizerProfilesTable.rejectedAt),
          ),
        )
        .returning({ id: organizerProfilesTable.id });

      const [row] = await tx
        .select({
          organizerId: organizerProfilesTable.id,
          organizationName: organizerProfilesTable.organizationName,
          organizerFirstName: usersTable.firstName,
          organizerLastName: usersTable.lastName,
        })
        .from(organizerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
        .where(eq(organizerProfilesTable.id, organizerId));

      return row ? { ...row, justReopened: updated.length > 0 } : null;
    });
  },

  /**
   * Deletes a junk/spam applicant's whole account (a real applicant is rejected instead, which
   * keeps it). Only while the organizer is not verified. Deleting the users row cascades to the
   * profile, role, tokens and sessions.
   * The profile row is locked first (FOR UPDATE), so a Verify running at the same moment
   * waits, then finds nothing: a just-verified organizer is never deleted.
   */
  async deleteUnverifiedOrganizer(
    organizerId: string,
  ): Promise<"deleted" | "not_found" | "already_verified"> {
    return db.transaction(async (tx) => {
      const [organizer] = await tx
        .select({
          userId: organizerProfilesTable.userId,
          verifiedAt: organizerProfilesTable.verifiedAt,
        })
        .from(organizerProfilesTable)
        .where(eq(organizerProfilesTable.id, organizerId))
        .for("update");

      if (!organizer) return "not_found";
      if (organizer.verifiedAt) return "already_verified";

      await tx.delete(usersTable).where(eq(usersTable.id, organizer.userId));
      return "deleted";
    });
  },

  /** The admin decision on a user's organizer profile. null = the user has no profile. */
  async findVerificationByUserId(
    userId: string,
  ): Promise<{ verifiedAt: Date | null; rejectedAt: Date | null } | null> {
    const [row] = await db
      .select({
        verifiedAt: organizerProfilesTable.verifiedAt,
        rejectedAt: organizerProfilesTable.rejectedAt,
      })
      .from(organizerProfilesTable)
      .where(eq(organizerProfilesTable.userId, userId))
      .limit(1);
    return row ?? null;
  },

  /** A user's own organizer application. null = the user has no organizer profile. */
  async findApplicationByUserId(userId: string) {
    const rows = await db
      .select({
        organizationName: organizerProfilesTable.organizationName,
        organizationWebsite: organizerProfilesTable.organizationWebsite,
        appliedAt: organizerProfilesTable.createdAt,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        verifiedAt: organizerProfilesTable.verifiedAt,
        rejectedAt: organizerProfilesTable.rejectedAt,
        rejectionReason: organizerProfilesTable.rejectionReason,
      })
      .from(organizerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
      .where(eq(organizerProfilesTable.userId, userId))
      .limit(1);
    // at(0) is typed as possibly undefined, so callers must handle "no profile".
    return rows.at(0) ?? null;
  },

  /**
   * One application for the admin's review page: the profile, the applicant's account and role,
   * and whether another organizer already uses this organisation name or website (compared
   * without regard to case). null = no such application. Named columns only: never the
   * password hash.
   */
  async findDetail(organizerId: string) {
    const [row] = await db
      .select({
        id: organizerProfilesTable.id,
        organizationName: organizerProfilesTable.organizationName,
        organizationWebsite: organizerProfilesTable.organizationWebsite,
        appliedAt: organizerProfilesTable.createdAt,
        verifiedAt: organizerProfilesTable.verifiedAt,
        rejectedAt: organizerProfilesTable.rejectedAt,
        rejectionReason: organizerProfilesTable.rejectionReason,
        userId: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        accountStatus: usersTable.status,
        userCreatedAt: usersTable.createdAt,
        role: rolesTable.role,
      })
      .from(organizerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
      // leftJoin: an account with no role row must still be found (role = null).
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(eq(organizerProfilesTable.id, organizerId))
      .limit(1);
    if (!row) return null;

    // The values are bound parameters (never pasted into SQL). No website = nothing to compare.
    const [{ total }] = await db
      .select({ total: count() })
      .from(organizerProfilesTable)
      .where(
        and(
          ne(organizerProfilesTable.id, organizerId),
          or(
            sql`lower(${organizerProfilesTable.organizationName}) = lower(${row.organizationName})`,
            row.organizationWebsite
              ? sql`lower(${organizerProfilesTable.organizationWebsite}) = lower(${row.organizationWebsite})`
              : undefined,
          ),
        ),
      );

    return { ...row, hasDuplicate: total > 0 };
  },

  /** The account behind an organizer profile, for re-sending the invite. */
  async findInviteeById(
    organizerId: string,
  ): Promise<{ userId: string } | null> {
    const [row] = await db
      .select({ userId: organizerProfilesTable.userId })
      .from(organizerProfilesTable)
      .where(eq(organizerProfilesTable.id, organizerId))
      .limit(1);
    return row ?? null;
  },

  /** What verifying (and rejecting) needs to decide. null = no such organizer. */
  async findForVerify(organizerId: string) {
    const [row] = await db
      .select({
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        verifiedAt: organizerProfilesTable.verifiedAt,
        rejectedAt: organizerProfilesTable.rejectedAt,
      })
      .from(organizerProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, organizerProfilesTable.userId))
      .where(eq(organizerProfilesTable.id, organizerId));
    return row ?? null;
  },
};

export type OrganizerRepository = typeof organizerRepository;
