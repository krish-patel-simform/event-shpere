import { roleNameEnum, userStatusEnum } from "@/src/db/schemas";
import { z } from "zod";

//* POST /api/admin/users/[userId]/suspend and /reactivate: which user
export const userParamSchema = z.object({
  /** users.id of the user whose status changes. */
  userId: z.uuid(),
});

// The user after the change. Only these fields: parse() drops anything else, so a sensitive
// column added to a query later cannot reach the response.
export const userStatusResponseSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(userStatusEnum.enumValues),
});
export type UserStatusDto = z.infer<typeof userStatusResponseSchema>;

//* GET /api/admin/users: the list, filtered by role / status / search, sorted and paged

// The ONLY ways the list can be sorted. Never build ORDER BY from a string in the URL: this
// whitelist stops it. To add one: add it here AND to `sortOrders` in users.repository.ts.
export const userSorts = ["newest", "name"] as const;
export type UserSort = (typeof userSorts)[number];

// Every filter is optional: without them the list is not filtered. Missing keys arrive as
// undefined (parseQuery reads the URL into an object), so .optional() is enough.
export const getUsersQueryParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  role: z.enum(roleNameEnum.enumValues).optional(),
  status: z.enum(userStatusEnum.enumValues).optional(),
  /** Matches first name, last name or email. */
  search: z.string().trim().max(100).optional(),
  sort: z.enum(userSorts).default("newest"),
});
export type GetUsersQuery = z.infer<typeof getUsersQueryParams>;

//* GET /api/admin/users/[userId]: one user, for the profile page. Only the user's own account:
// what an organizer or a speaker adds (the application, the speaker profile) belongs to their
// own pages. The params are the same as suspend / reactivate: `userParamSchema` above.
export const userDetailResponseSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  /** Admin-only route: the admin needs it to tell people apart and contact them. */
  email: z.email(),
  status: z.enum(userStatusEnum.enumValues),
  /** One role per user; null for an account that has none. */
  role: z.enum(roleNameEnum.enumValues).nullable(),
  /** When they confirmed their email; null = not yet. */
  emailVerifiedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /**
   * Whether a password is set (false = an account someone else created that is not set up yet).
   * Only yes/no: the hash never leaves.
   */
  hasPassword: z.boolean(),
  /** What their role allows: permission keys. They are not edited per user. */
  permissions: z.array(z.string()),
});
export type UserDetailDto = z.infer<typeof userDetailResponseSchema>;

// One row of the list.
const userListItemSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  /** Admin-only route: the admin needs it to tell people apart and contact them. */
  email: z.email(),
  /** One role per user; null for an account that has none. */
  role: z.enum(roleNameEnum.enumValues).nullable(),
  status: z.enum(userStatusEnum.enumValues),
  emailVerified: z.boolean(),
  /** When the account was created. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserListItemDto = z.infer<typeof userListItemSchema>;

// `data` of the list response (pagination `meta` is sent next to it).
export const getUsersResponseSchema = z.array(userListItemSchema);
