import "server-only";
import { db } from "@/src/db/dbClient";
import {
  authSessionsTable,
  permissionsTable,
  RoleName,
  rolePermissionsTable,
  rolesTable,
  userRolesTable,
  usersTable,
  userStatusEnum,
} from "@/src/db/schemas";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  ilike,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { escapeLike } from "@/src/db/escape-like";
import type { UserSort } from "../schemas/users.schema";

type UserId = {
  userId: string;
};

// What a status change gives back. Named columns only: never the password hash or the email.
const statusColumns = {
  id: usersTable.id,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  status: usersTable.status,
};

type UserRoles = RoleName;

type UserStatus = (typeof userStatusEnum.enumValues)[number];

type GetUsersInput = {
  role: UserRoles | undefined;
  status: UserStatus | undefined;
  search: string | undefined;
  sort: UserSort;
  pageSize: number;
  page: number;
};

// Sort name (from the whitelist in the schema) → ORDER BY. Typed as a Record over that list, so
// adding a sort there without an order here is a compile error. `id` comes last in each: it breaks
// ties, so paging never shows a row twice or skips one.
const sortOrders: Record<UserSort, SQL[]> = {
  newest: [desc(usersTable.createdAt), desc(usersTable.id)],
  name: [
    asc(usersTable.firstName),
    asc(usersTable.lastName),
    asc(usersTable.id),
  ],
};

const getUserBasedOnRoleCondition = (role: UserRoles) =>
  eq(rolesTable.role, role);

const getuserBasedOnStatusCondition = (status: UserStatus) =>
  eq(usersTable.status, status);

export const userRepository = {
  /**
   * The user and their one role, for the rules the service checks before changing the status
   * (e.g. an administrator cannot be suspended). null = no such user. `role` is null for an
   * account that has none.
   */
  async findForStatusChange(input: UserId) {
    const rows = await db
      .select({
        id: usersTable.id,
        status: usersTable.status,
        role: rolesTable.role,
      })
      .from(usersTable)
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(eq(usersTable.id, input.userId))
      .limit(1);
    return rows.at(0) ?? null;
  },

  /**
   * One user for the admin's profile page: the account, its one role and the permissions of that
   * role. null = no such user. Named columns only: the password hash is read as a yes/no and
   * never returned.
   */
  async findDetail(input: UserId) {
    const [user] = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        status: usersTable.status,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        createdAt: usersTable.createdAt,
        hasPassword: sql<boolean>`${usersTable.passwordHash} is not null`,
        role: rolesTable.role,
        roleId: rolesTable.id,
      })
      .from(usersTable)
      // leftJoin: an account with no role row must still be found (role = null).
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(eq(usersTable.id, input.userId))
      .limit(1);
    if (!user) return null;

    const { roleId, ...account } = user;
    // No role, no permissions.
    const permissions = roleId
      ? await db
          .select({ key: permissionsTable.key })
          .from(rolePermissionsTable)
          .innerJoin(
            permissionsTable,
            eq(permissionsTable.id, rolePermissionsTable.permissionId),
          )
          .where(eq(rolePermissionsTable.roleId, roleId))
          .orderBy(asc(permissionsTable.key))
      : [];

    return { ...account, permissions: permissions.map(({ key }) => key) };
  },

  /**
   * Suspends an ACTIVE user and ends all their sessions, in one transaction: either both happen
   * or neither. The status is part of the WHERE, so the check and the change are one step (two
   * clicks at once cannot both win). Returns undefined when the user was not active (or does not
   * exist): nothing was changed.
   * The sessions are ended so that reactivating the user later does not bring their old logins
   * back to life.
   */
  async suspendUser(input: UserId) {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .update(usersTable)
        .set({ status: "suspended" })
        .where(
          and(eq(usersTable.id, input.userId), eq(usersTable.status, "active")),
        )
        .returning(statusColumns);
      if (!user) return undefined;

      await tx
        .update(authSessionsTable)
        .set({ isRevoked: true })
        .where(eq(authSessionsTable.userId, input.userId));
      return user;
    });
  },

  /**
   * Reactivates a SUSPENDED user. Returns undefined when the user was not suspended (or does not
   * exist). Only a suspended user can come back to `active`: a pending one has no password yet,
   * and the database refuses `active` without one.
   */
  async reActiveUser(input: UserId) {
    const [user] = await db
      .update(usersTable)
      .set({ status: "active" })
      .where(
        and(
          eq(usersTable.id, input.userId),
          eq(usersTable.status, "suspended"),
        ),
      )
      .returning(statusColumns);
    return user;
  },

  async getUsers(input: GetUsersInput) {
    const { role, status, search, sort, pageSize, page } = input;

    const conditions: (SQL | undefined)[] = [];

    if (status) conditions.push(getuserBasedOnStatusCondition(status));

    if (role) conditions.push(getUserBasedOnRoleCondition(role));

    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      conditions.push(
        or(
          ilike(usersTable.firstName, pattern),
          ilike(usersTable.lastName, pattern),
          ilike(usersTable.email, pattern),
        ),
      );
    }
    const where = and(...conditions);
    // No brackets: this is the whole page of rows (`const [users]` would keep only the first).
    const users = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        status: usersTable.status,
        role: rolesTable.role,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(where)
      .orderBy(...sortOrders[sort])
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await db
      .select({ total: countDistinct(usersTable.id) })
      .from(usersTable)
      .leftJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
      .leftJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
      .where(where);

    return { users, meta: { pageSize, page, total } };
  },
};

export type UserRepository = typeof userRepository;
