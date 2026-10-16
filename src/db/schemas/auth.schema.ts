import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "pending",
]);

// No "guest": a guest has no account/session, so there is no user_roles row to hold it.
export const roleNameEnum = pgEnum("role_name", [
  "user",
  "speaker",
  "organizer",
  "admin",
]);

export const authTokenTypeEnum = pgEnum("auth_token_type", [
  // First password for accounts created by someone else (user/organizer/speaker).
  "account_setup",
  "password_reset",
  "email_verify",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Step 1: the account itself (identity + login credentials only). */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    // Always stored lowercase; the service normalizes, the check enforces.
    email: varchar("email", { length: 255 }).notNull().unique(),
    // Null until the person sets a password via the account_setup link.
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "users_active_has_password",
      sql`${t.status} <> 'active' OR ${t.passwordHash} IS NOT NULL`,
    ),
  ],
);

/** Step 2: optional personal details, one-to-one with users (any role). */
export const userProfilesTable = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 32 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
});

//*  Step 3: named roles (user, speaker, organizer, admin). Guest = no session, not a row. */
export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleNameEnum("role").notNull().unique(),
  description: text("description").notNull(),
});

//** Step 4: every allowable action, e.g. `event:create`. */
export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
});

//** Step 5: which role may do what (many-to-many). */
export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissionsTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_idx").on(t.permissionId),
  ],
);

//** Step 6: which user holds which role (many-to-many). */
export const userRolesTable = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // restrict: a role that is still assigned to someone cannot be deleted.
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
  ],
);

//** Step 7: organizer-only data, one-to-one with users. */
export const organizerProfilesTable = pgTable(
  "organizer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    organizationWebsite: text("organization_website"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // set null: keep the verification record if the approving admin is deleted.
    verifiedBy: uuid("verified_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "organizer_profiles_verified_by_needs_at",
      sql`${t.verifiedBy} IS NULL OR ${t.verifiedAt} IS NOT NULL`,
    ),
  ],
);

/**
 * Step 8: speaker-only data, one-to-one with users. Name and email come from users;
 * rich content (bio, photo, ...) lives in the CMS, linked by cms_speaker_id.
 */
export const speakersProfilesTable = pgTable("speaker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  // Null until the CMS entry exists.
  cmsSpeakerId: varchar("cms_speaker_id", { length: 255 }).unique(),
  createdBy: uuid("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

//** Step 9: single-use, expiring links (account setup, password reset, email verify). Only the hash is stored. */
export const authTokensTable = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    type: authTokenTypeEnum("type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("auth_tokens_user_type_idx").on(t.userId, t.type),
    check(
      "auth_tokens_expiry_after_creation",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
  ],
);

//** Step 10: active logins (one user, many devices). Only the token hash is stored. */
export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Set on logout (or when an admin ends the session); a revoked session never comes back.
    isRevoked: boolean("is_revoked").notNull().default(false),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("auth_sessions_user_idx").on(t.userId),
    index("auth_sessions_expires_idx").on(t.expiresAt),
  ],
);

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  profile: one(userProfilesTable),
  organizerProfile: one(organizerProfilesTable),
  speakerProfile: one(speakersProfilesTable),
  userRoles: many(userRolesTable),
  sessions: many(authSessionsTable),
  tokens: many(authTokensTable),
}));

export const userProfilesRelations = relations(
  userProfilesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userProfilesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const rolesRelations = relations(rolesTable, ({ many }) => ({
  rolePermissions: many(rolePermissionsTable),
  userRoles: many(userRolesTable),
}));

export const permissionsRelations = relations(permissionsTable, ({ many }) => ({
  rolePermissions: many(rolePermissionsTable),
}));

export const rolePermissionsRelations = relations(
  rolePermissionsTable,
  ({ one }) => ({
    // may be many to one relation ship
    role: one(rolesTable, {
      fields: [rolePermissionsTable.roleId],
      references: [rolesTable.id],
    }),
    // may be many to one relattionship
    permission: one(permissionsTable, {
      fields: [rolePermissionsTable.permissionId],
      references: [permissionsTable.id],
    }),
  }),
);

export const userRolesRelations = relations(userRolesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userRolesTable.userId],
    references: [usersTable.id],
  }),
  role: one(rolesTable, {
    fields: [userRolesTable.roleId],
    references: [rolesTable.id],
  }),
}));

export const organizerProfilesRelations = relations(
  organizerProfilesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [organizerProfilesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const speakersProfilesRelations = relations(
  speakersProfilesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [speakersProfilesTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const authTokensRelations = relations(authTokensTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [authTokensTable.userId],
    references: [usersTable.id],
  }),
}));

export const authSessionsRelations = relations(
  authSessionsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [authSessionsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type Role = typeof rolesTable.$inferSelect;
export type RoleName = (typeof roleNameEnum.enumValues)[number];
export type Permission = typeof permissionsTable.$inferSelect;
export type OrganizerProfile = typeof organizerProfilesTable.$inferSelect;
export type Speaker = typeof speakersProfilesTable.$inferSelect;
export type AuthToken = typeof authTokensTable.$inferSelect;
export type AuthSession = typeof authSessionsTable.$inferSelect;
