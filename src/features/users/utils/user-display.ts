import type { ComponentProps } from "react";
import type { Badge } from "@/src/core/ui";
import type {
  AccountStatus,
  AdminUser,
  UserRole,
  UserTabKey,
} from "../types/admin-users";
import { formatDate } from "./format-date";
import { roleLabel } from "./role-label";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function userFullName(
  user: Pick<AdminUser, "firstName" | "lastName">,
): string {
  return `${user.firstName} ${user.lastName}`;
}

/** What the Role column shows: an organizer's badge also says where their application stands. */
export function roleBadge(user: Pick<AdminUser, "role" | "organizerStatus">): {
  label: string;
  tone: BadgeTone;
} {
  if (user.role === "organizer") {
    if (user.organizerStatus === "pending")
      return { label: "Organizer pending", tone: "warning" };
    if (user.organizerStatus === "rejected")
      return { label: "Organizer rejected", tone: "danger" };
    return { label: roleLabel("organizer"), tone: "neutral" };
  }
  const tones: Record<Exclude<UserRole, "organizer">, BadgeTone> = {
    user: "brand",
    speaker: "success",
    admin: "surface",
  };
  return { label: roleLabel(user.role), tone: tones[user.role] };
}

const STATUS_BADGES: Record<AccountStatus, { label: string; tone: BadgeTone }> =
  {
    active: { label: "Active", tone: "success" },
    suspended: { label: "Suspended", tone: "danger" },
    pending: { label: "Pending", tone: "neutral" },
  };

export function statusBadge(status: AccountStatus) {
  return STATUS_BADGES[status];
}

const utcDay = (time: number) => Math.floor(time / DAY_MS);

/**
 * "Never", "Just now", "2 hours ago" (earlier the same UTC day), "Yesterday", or a date.
 * Counts up to `asOf` (not the clock), so the server and the browser print the same text.
 */
export function formatLastActive(
  lastActiveAt: string | null,
  asOf: string,
): string {
  if (lastActiveAt === null) return "Never";
  const then = new Date(lastActiveAt).getTime();
  const now = new Date(asOf).getTime();

  const daysAgo = utcDay(now) - utcDay(then);
  if (daysAgo <= 0) {
    const hours = Math.floor((now - then) / HOUR_MS);
    if (hours < 1) return "Just now";
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (daysAgo === 1) return "Yesterday";
  return formatDate(lastActiveAt);
}

export const USER_TABS: readonly { key: UserTabKey; label: string }[] = [
  { key: "all", label: "All users" },
  { key: "user", label: "Attendees" },
  { key: "speaker", label: "Speakers" },
  { key: "organizer", label: "Organizers" },
  { key: "admin", label: "Administrators" },
  { key: "unverified", label: "Unverified email" },
  { key: "suspended", label: "Suspended" },
];

export function matchesTab(user: AdminUser, tab: UserTabKey): boolean {
  switch (tab) {
    case "all":
      return true;
    case "unverified":
      return !user.emailVerified;
    case "suspended":
      return user.status === "suspended";
    default:
      return user.role === tab;
  }
}

export function matchesUserSearch(user: AdminUser, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [userFullName(user), user.email].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export type UserSort = "newest" | "name" | "seen";

/** A new sorted array: newest joined first, name A–Z, or most recently active first (never-active last). */
export function sortUsers(
  users: readonly AdminUser[],
  sort: UserSort,
): AdminUser[] {
  const time = (iso: string | null) =>
    iso === null ? -Infinity : Date.parse(iso);
  return [...users].sort((a, b) => {
    if (sort === "name")
      return userFullName(a).localeCompare(userFullName(b), "en");
    if (sort === "seen") {
      const diff = time(b.lastActiveAt) - time(a.lastActiveAt);
      return Number.isNaN(diff) ? 0 : diff;
    }
    return Date.parse(b.joinedAt) - Date.parse(a.joinedAt);
  });
}
