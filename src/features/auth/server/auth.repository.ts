import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import {
  authTokensTable,
  organizerProfilesTable,
  rolesTable,
  userProfilesTable,
  userRolesTable,
  usersTable,
} from "../../../db/schemas";

/** What the signup service hands over: hashes only, never the plain password or token. */
export type NewOrganizerSignup = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  organizationName: string;
  organizationWebsite: string | null;
  /** From createEmailVerifyToken(): the link token's hash. The 6-digit code is not here (Redis). */
  verifyToken: { tokenHash: string; expiresAt: Date };
};

export type NewUserSignup = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  city: string | null;
  postalCode: string | null;
  avatarUrl: string | null;
  verifyToken: { tokenHash: string; expiresAt: Date };
};

export const authRepository = {
  /**
   * Includes passwordHash: the service verifies it, and a null hash means the account
   * has not set its password yet. Only the login flow may use this.
   */
  async findUserForLogin(email: string) {
    const [row] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        passwordHash: usersTable.passwordHash,
        status: usersTable.status,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    return row ?? null;
  },

  /**
   * Cheap pre-check so a duplicate signup skips the slow argon2 hash. NOT a guarantee:
   * two signups at the same moment both pass it; signUpOrganizer's insert decides.
   */
  async isEmailTaken(email: string): Promise<boolean> {
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return row !== undefined;
  },

  /**
   * Creates a self-registered organizer in ONE transaction: user (pending, with password)
   */
  async signUpOrganizer(input: NewOrganizerSignup) {
    return db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.role, "organizer"));
      if (!role) throw new Error('Role "organizer" is missing; run the seed');

      // ON CONFLICT DO NOTHING: an existing email returns no row instead of throwing, and
      // the database decides atomically, so two parallel signups cannot both get through.
      const [user] = await tx
        .insert(usersTable)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          // Pending until the email OTP is verified; login refuses pending accounts.
          status: "pending",
        })
        .onConflictDoNothing({ target: usersTable.email })
        .returning();
      // Nothing has been written yet, so returning here leaves nothing behind.
      if (!user) return { ok: false as const, reason: "EMAIL_TAKEN" as const };

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

      // The verify-email link token, in the same transaction: a user never exists without one.
      await tx.insert(authTokensTable).values({
        userId: user.id,
        type: "email_verify",
        tokenHash: input.verifyToken.tokenHash,
        expiresAt: input.verifyToken.expiresAt,
      });

      return { ok: true as const, user, profile };
    });
  },

  async signUpUser(input: NewUserSignup) {
    return db.transaction(async (tx) => {
      //get the role for the user
      const [role] = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.role, "user"));
      if (!role) throw new Error('Role "user" is missing; run the seed');

      // create user with Do nothing if conflict
      const [user] = await tx
        .insert(usersTable)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          // Pending until the email OTP is verified; login refuses pending accounts.
          status: "pending",
        })
        .onConflictDoNothing({ target: usersTable.email })
        .returning();
      // Nothing has been written yet, so returning here leaves nothing behind.
      if (!user) return { ok: false as const, reason: "EMAIL_TAKEN" as const };

      await tx
        .insert(userRolesTable)
        .values({ userId: user.id, roleId: role.id });

      // create an profile for the user
      const [profile] = await tx
        .insert(userProfilesTable)
        .values({
          userId: user.id,
          city: input.city,
          avatarUrl: input.avatarUrl,
          phone: input.phone,
          postalCode: input.postalCode,
        })
        .returning();

      //create an authToken for the verify the email
      await tx.insert(authTokensTable).values({
        userId: user.id,
        type: "email_verify",
        tokenHash: input.verifyToken.tokenHash,
        expiresAt: input.verifyToken.expiresAt,
      });

      return { ok: true as const, user, profile };
    });
  },
};

export type AuthRepository = typeof authRepository;
