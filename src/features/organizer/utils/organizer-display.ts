import type { ComponentProps } from "react";
import type { Badge, Tab } from "@/src/core/ui";
import type {
  OrganizerListItemDto,
  OrganizerReviewStatus,
  OrganizerSort,
  OrganizerVerificationFilter,
} from "../schemas/organizer.schemas";
import type { OrganizerTabKey } from "../types/admin-organizers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The tabs above the list: each one is one list of GET /api/admin/organizers. Nothing is
 * requested for a tab until the admin opens it.
 */
export const ORGANIZER_TABS: readonly Tab<OrganizerTabKey>[] = [
  { key: "all", label: "All organizers" },
  { key: "pending", label: "Awaiting approval", tone: "warning" },
  { key: "verified", label: "Approved", tone: "success" },
  { key: "rejected", label: "Rejected", tone: "danger" },
];

/** What a tab asks the server for: one list, or (for "all") no verification filter. */
export function tabVerification(
  tab: OrganizerTabKey,
): OrganizerVerificationFilter | undefined {
  return tab === "all" ? undefined : tab;
}

/** One line under the tabs saying what the selected list is. */
export const TAB_DESCRIPTIONS: Record<OrganizerTabKey, string> = {
  pending:
    "Email must be verified before an application can be approved. Oldest applications are shown first.",
  verified: "Can create, edit and publish their own events.",
  rejected: "Applicants stay on their attendee account.",
  all: "Every organizer account, whatever stage the application is at.",
};

/** The waiting list is a queue (oldest first); the other lists show what happened last. */
export function defaultSort(tab: OrganizerTabKey): OrganizerSort {
  return tab === "pending" ? "oldest" : "newest";
}

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

/** Where an application stands: not a column, worked out from the two decision dates. */
export function organizerStatus(
  organizer: Pick<OrganizerListItemDto, "verifiedAt" | "rejectedAt">,
): OrganizerReviewStatus {
  if (organizer.verifiedAt) return "verified";
  if (organizer.rejectedAt) return "rejected";
  return "pending";
}

export const STATUS_BADGES: Record<
  OrganizerReviewStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "Awaiting approval", tone: "warning" },
  verified: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

/**
 * The sort choices of a tab, named after the date the server sorts that list by. The "all"
 * list has no single decision date, so it is sorted by when the application came in.
 */
export const SORT_OPTIONS: Record<
  OrganizerTabKey,
  readonly { value: OrganizerSort; label: string }[]
> = {
  all: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ],
  pending: [
    { value: "oldest", label: "Oldest first" },
    { value: "newest", label: "Newest first" },
  ],
  verified: [
    { value: "newest", label: "Recently approved" },
    { value: "oldest", label: "Earliest approved" },
  ],
  rejected: [
    { value: "newest", label: "Recently rejected" },
    { value: "oldest", label: "Earliest rejected" },
  ],
};

/** An application waiting longer than this many days is shown in red. */
export const OVERDUE_AFTER_DAYS = 8;

/** Whole days between the application and `asOf` (never negative). */
export function daysWaiting(appliedAt: string, asOf: string): number {
  const elapsed = new Date(asOf).getTime() - new Date(appliedAt).getTime();
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/** 0 → "Applied today", 1 → "1 day waiting", 14 → "14 days waiting". */
export function waitingLabel(days: number): string {
  if (days === 0) return "Applied today";
  return `${days} ${days === 1 ? "day" : "days"} waiting`;
}
