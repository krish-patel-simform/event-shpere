import type { MeDto } from "@/src/features/auth";
import type { PendingOrganizer } from "@/src/features/organizer";

// What the admin's "Platform overview" shows. No admin stats API exists yet: the page renders
// sample data (utils/admin-overview.sample.ts) in these shapes until it does.

export type AdminKpis = {
  totalUsers: number;
  /** Accounts created in the period. */
  newUsers: number;
  approvedOrganizers: number;
  pendingOrganizers: number;
  publishedEvents: number;
  draftEvents: number;
  registrations: number;
  /** Change vs the previous period, in percent (11 = +11 %). */
  registrationsChangePct: number;
  suspendedUsers: number;
  suspendedThisMonth: number;
};

export type WeeklySignups = {
  /** ISO date (yyyy-mm-dd) of the week's first day. */
  weekStart: string;
  attendees: number;
  organizerApplications: number;
};

export type EventStatus = "published" | "draft" | "completed" | "cancelled";
export type EventStatusCounts = Record<EventStatus, number>;

export type RoleCounts = Record<MeDto["role"], number>;

export type AdminOverviewData = {
  /** Length of the period the KPIs cover, e.g. 30 = "last 30 days". */
  periodDays: number;
  kpis: AdminKpis;
  /** The first few organizers waiting for approval (oldest first). */
  pendingOrganizers: PendingOrganizer[];
  /** All of them, for "View all N". */
  pendingOrganizersTotal: number;
  /** Oldest week first. */
  weeklySignups: WeeklySignups[];
  eventsByStatus: EventStatusCounts;
  accountsByRole: RoleCounts;
};
