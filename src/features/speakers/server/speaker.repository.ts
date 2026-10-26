import "server-only";
import {
  and,
  asc,
  count,
  DrizzleQueryError,
  eq,
  ilike,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { escapeLike } from "../../../db/escape-like";
import {
  authTokensTable,
  rolesTable,
  speakersProfilesTable,
  userRolesTable,
  usersTable,
  type User,
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
  /** Strapi documentId of the Speaker entry, created before this insert. */
  cmsSpeakerId: string;
  /** users.id of the organizer/admin who invited the speaker (from the access token). */
  createdBy: string;
  setupToken: { tokenHash: string; expiresAt: Date };
};

/** A speaker found by email: basic Postgres data, nothing from the CMS. */
export type ExistingSpeakerRow = {
  /** speaker_profiles.id */
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  slug: string;
  status: User["status"];
};

/** What the public reads need from Postgres; the rest of the profile comes from the CMS. */
export type SpeakerRow = {
  slug: string;
  firstName: string;
  lastName: string;
  /** Strapi documentId; null if the CMS entry was never linked. */
  cmsSpeakerId: string | null;
};

const speakerRowColumns = {
  slug: speakersProfilesTable.slug,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  cmsSpeakerId: speakersProfilesTable.cmsSpeakerId,
};

/** The logged-in speaker's own profile row (found by their user id, never by a request id). */
export type OwnSpeakerRow = SpeakerRow & {
  /** speaker_profiles.id */
  id: string;
};

// Suspended accounts are not shown publicly. Pending (invited, no password yet) are:
// a speaker is usable as soon as an organizer adds them.
const isPubliclyVisible = ne(usersTable.status, "suspended");

export const speakerRepository = {
  /**
   * One page of public speakers, sorted by name, plus the matching total.
   * `search` matches anywhere in "first last", case-insensitive, as a bound parameter.
   */
  async listSpeakers(params: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: SpeakerRow[]; total: number }> {
    const where = and(
      isPubliclyVisible,
      params.search
        ? ilike(
            sql`${usersTable.firstName} || ' ' || ${usersTable.lastName}`,
            `%${escapeLike(params.search)}%`,
          )
        : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      db
        .select(speakerRowColumns)
        .from(speakersProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, speakersProfilesTable.userId))
        .where(where)
        // id breaks ties, so paging never shows a row twice or skips one.
        .orderBy(
          asc(usersTable.firstName),
          asc(usersTable.lastName),
          asc(speakersProfilesTable.id),
        )
        .limit(params.limit)
        .offset(params.offset),
      // Same join + same where as the page, so `total` counts exactly the matches.
      db
        .select({ total: count() })
        .from(speakersProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, speakersProfilesTable.userId))
        .where(where),
    ]);
    return { rows, total };
  },

  /**
   * The account behind a slug, for re-sending the invite. Unlike findBySlug it does NOT
   * hide suspended accounts: the invite service answers those with a clear 409 instead.
   */
  async findInviteeBySlug(slug: string): Promise<{ userId: string } | null> {
    const [row] = await db
      .select({ userId: speakersProfilesTable.userId })
      .from(speakersProfilesTable)
      .where(eq(speakersProfilesTable.slug, slug))
      .limit(1);
    return row ?? null;
  },

  /** The speaker profile of this user; null = the user is not a speaker. */
  async findOwnSpeaker(userId: string): Promise<OwnSpeakerRow | null> {
    const [row] = await db
      .select({ id: speakersProfilesTable.id, ...speakerRowColumns })
      .from(speakersProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, speakersProfilesTable.userId))
      .where(eq(speakersProfilesTable.userId, userId))
      .limit(1);
    return row ?? null;
  },

  /** Renames the user. One UPDATE on one table, so no transaction is needed. */
  async updateNames(
    userId: string,
    names: { firstName: string; lastName: string },
  ): Promise<void> {
    await db
      .update(usersTable)
      .set({ firstName: names.firstName, lastName: names.lastName })
      .where(eq(usersTable.id, userId));
  },

  /** Links (or re-links) the profile to its Strapi entry. */
  async setCmsSpeakerId(speakerId: string, documentId: string): Promise<void> {
    await db
      .update(speakersProfilesTable)
      .set({ cmsSpeakerId: documentId })
      .where(eq(speakersProfilesTable.id, speakerId));
  },

  /** One public speaker by slug; null = no such (visible) speaker. */
  async findBySlug(slug: string): Promise<SpeakerRow | null> {
    const [row] = await db
      .select(speakerRowColumns)
      .from(speakersProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, speakersProfilesTable.userId))
      .where(and(eq(speakersProfilesTable.slug, slug), isPubliclyVisible))
      .limit(1);
    return row ?? null;
  },

  /**
   * Who already uses this email. null = nobody (free to invite).
   * `speaker` is set when that account has a speaker profile; null = another role
   * (user, organizer, admin).
   */
  async findAccountByEmail(
    email: string,
  ): Promise<{ speaker: ExistingSpeakerRow | null } | null> {
    const [row] = await db
      .select({
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        status: usersTable.status,
        // LEFT join: null for accounts that are not speakers.
        speakerId: speakersProfilesTable.id,
        slug: speakersProfilesTable.slug,
      })
      .from(usersTable)
      .leftJoin(
        speakersProfilesTable,
        eq(speakersProfilesTable.userId, usersTable.id),
      )
      .where(eq(usersTable.email, email))
      .limit(1);
    if (!row) return null;

    const { speakerId, slug, ...user } = row;
    return {
      speaker:
        speakerId !== null && slug !== null
          ? { id: speakerId, slug, ...user }
          : null,
    };
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
      // Two invites for the same email at once: the lookup passed for both, the DB stops one.
      // Other unique clashes (slug, cms id) are not the caller's fault: let them be a 500.
      if (violatedUniqueConstraint(error) === "users_email_unique")
        return { ok: false as const, reason: "EMAIL_TAKEN" as const };
      throw error;
    }
  },
};

export type SpeakerRepository = typeof speakerRepository;
