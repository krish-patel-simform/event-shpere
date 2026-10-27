import "server-only";
import type { RoleName, User } from "../../../db/schemas";
import type {
  UserDetailDto,
  UserListItemDto,
  UserStatusDto,
} from "../schemas/users.schema";

// One user as the repository returns it for the profile page (Date objects; whether there is a
// password, not the hash).
type UserDetailRow = Pick<
  User,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "status"
  | "emailVerifiedAt"
  | "createdAt"
> & {
  role: RoleName | null;
  hasPassword: boolean;
  permissions: string[];
};

// Picks fields one by one: passwordHash and other internals never leave.
export function toUserDetailDto(row: UserDetailRow): UserDetailDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    status: row.status,
    role: row.role,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    hasPassword: row.hasPassword,
    permissions: row.permissions,
  };
}

// One row of the list as the repository returns it (Date objects, the email-verified time).
type UserListRow = Pick<
  User,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "status"
  | "emailVerifiedAt"
  | "createdAt"
  | "updatedAt"
> & { role: RoleName | null };

// Picks fields one by one: passwordHash and other internals never leave.
export function toUserListItemDto(row: UserListRow): UserListItemDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: row.role,
    status: row.status,
    // The admin only needs yes/no, not when.
    emailVerified: row.emailVerifiedAt !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Picks fields one by one, so a column added to the query later never leaves by accident.
export function toUserStatusDto(row: UserStatusDto): UserStatusDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
  };
}
