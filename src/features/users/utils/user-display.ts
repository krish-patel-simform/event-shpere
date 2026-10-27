import type { ComponentProps } from "react";
import { roleLabel } from "@/src/core/auth/role-label";
import type { Badge, Tab } from "@/src/core/ui";
import type { AccountStatus, UserRole, UserTabKey } from "../types/admin-users";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

export function userFullName(user: {
  firstName: string;
  lastName: string;
}): string {
  return `${user.firstName} ${user.lastName}`;
}

const ROLE_TONES: Record<UserRole, BadgeTone> = {
  user: "brand",
  speaker: "success",
  organizer: "neutral",
  admin: "surface",
};

/** What the Role column shows. An account with no role (broken data) says so. */
export function roleBadge(role: UserRole | null): {
  label: string;
  tone: BadgeTone;
} {
  if (role === null) return { label: "No role", tone: "neutral" };
  return { label: roleLabel(role), tone: ROLE_TONES[role] };
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

/** What a role lets a person do, in one line: the role picker and the profile page. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  user: "Can register for events, book sessions and vote in polls",
  speaker: "Can edit their speaker profile and see their sessions",
  organizer:
    "Can create and publish their own events. Normally added by approving an application.",
  admin: "Full platform access, including approvals and suspensions",
};

/**
 * Which admin actions the profile page offers for this account. The server refuses the same
 * ones: an administrator is never suspended or sent a reset link, a reset link needs an active
 * account (a pending one has no password yet and needs the set-password invite instead), and
 * only an active user can be suspended or a suspended one reactivated.
 */
export function adminActionsFor(user: {
  status: AccountStatus;
  role: UserRole | null;
}) {
  const isAdmin = user.role === "admin";
  return {
    canSuspend: user.status === "active" && !isAdmin,
    canReactivate: user.status === "suspended",
    canSendResetLink: user.status === "active" && !isAdmin,
    /** A pending account has no password yet: it gets the set-password invite instead. */
    canResendInvite: user.status === "pending",
    /** Why there is no reset link button, when there is a reason worth showing. */
    resetLinkUnavailable:
      user.status === "suspended"
        ? "A suspended account cannot be sent a reset link. Reactivate it first."
        : null,
  };
}

export const USER_TABS: readonly Tab<UserTabKey>[] = [
  { key: "all", label: "All users" },
  { key: "user", label: "Attendees" },
  { key: "speaker", label: "Speakers" },
  { key: "organizer", label: "Organizers" },
  { key: "admin", label: "Administrators" },
  { key: "suspended", label: "Suspended", tone: "danger" },
];

/** What a tab asks the server for: a role, a status, or (for "all") nothing. */
export function tabFilter(tab: UserTabKey): {
  role?: UserRole;
  status?: AccountStatus;
} {
  switch (tab) {
    case "all":
      return {};
    case "suspended":
      return { status: "suspended" };
    default:
      return { role: tab };
  }
}
