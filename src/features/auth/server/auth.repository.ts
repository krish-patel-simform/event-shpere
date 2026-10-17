import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { usersTable } from "../../../db/schemas";

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
};

export type AuthRepository = typeof authRepository;
