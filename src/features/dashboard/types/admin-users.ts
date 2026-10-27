import type { MeDto } from "@/src/features/auth";
import type { OrganizerReviewStatus } from "@/src/features/organizer";

// What the admin "Users" page shows. No admin users API exists yet: the page renders sample data
// (utils/admin-users.sample.ts) in these shapes until it does.

export type UserRole = MeDto["role"];

/** `pending` = created but the person has not set a password / verified their email yet. */
export type AccountStatus = "active" | "suspended" | "pending";

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** One role per user. */
  role: UserRole;
  /** Only for organizers: where their application stands. null for everyone else. */
  organizerStatus: OrganizerReviewStatus | null;
  emailVerified: boolean;
  status: AccountStatus;
  /** ISO date-time the account was created. */
  joinedAt: string;
  /** ISO date-time of the last login; null = never logged in. */
  lastActiveAt: string | null;
};

/** The tabs above the list: each is a filter and shows how many users match it. */
export type UserTabKey =
  | "all"
  | "user"
  | "speaker"
  | "organizer"
  | "admin"
  | "unverified"
  | "suspended";

export type AdminUsersData = {
  /** ISO date-time the list was loaded: "2 hours ago" counts up to it. */
  asOf: string;
  /** Totals for the whole platform; `users` holds one page. */
  counts: Record<UserTabKey, number>;
  users: AdminUser[];
  page: { page: number; pageSize: number };
};
