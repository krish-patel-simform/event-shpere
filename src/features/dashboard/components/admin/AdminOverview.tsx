"use client";

import { ADMIN_ROUTES } from "../../nav-items";
import type { AdminKpis, AdminOverviewData } from "../../types/admin-overview";
import { formatCount } from "@/src/core/format/format-number";
import { KpiCard, type KpiTrend } from "../KpiCard";
import { OrganizerApprovalQueue } from "./OrganizerApprovalQueue";
import { PlatformBreakdown } from "./PlatformBreakdown";
import { WeeklySignupsChart } from "./WeeklySignupsChart";

function registrationsTrend(changePct: number): KpiTrend {
  if (changePct > 0)
    return { text: `▲ ${changePct}% vs last period`, tone: "up" };
  if (changePct < 0) {
    return {
      text: `▼ ${Math.abs(changePct)}% vs last period`,
      tone: "warning",
    };
  }
  return { text: "Same as last period", tone: "neutral" };
}

function kpiCards(kpis: AdminKpis) {
  return [
    {
      label: "Total users",
      value: kpis.totalUsers,
      trend: { text: `▲ ${formatCount(kpis.newUsers)} new`, tone: "up" },
    },
    {
      label: "Approved organizers",
      value: kpis.approvedOrganizers,
      trend: {
        text: `${formatCount(kpis.pendingOrganizers)} awaiting approval`,
        tone: kpis.pendingOrganizers > 0 ? "warning" : "neutral",
      },
    },
    {
      label: "Published events",
      value: kpis.publishedEvents,
      trend: {
        text: `${formatCount(kpis.draftEvents)} drafts in progress`,
        tone: "neutral",
      },
    },
    {
      label: "Event registrations",
      value: kpis.registrations,
      trend: registrationsTrend(kpis.registrationsChangePct),
    },
    {
      label: "Suspended users",
      value: kpis.suspendedUsers,
      trend: {
        text: `${formatCount(kpis.suspendedThisMonth)} this month`,
        tone: "neutral",
      },
    },
  ] satisfies { label: string; value: number; trend: KpiTrend }[];
}

/** The admin's dashboard: platform numbers, the organizer approval queue and two breakdowns. */
export function AdminOverview({ data }: { data: AdminOverviewData }) {
  // TODO(API): approve = POST /api/admin/organizers/:id/verify,
  // reject = POST /api/admin/organizers/:id/reject with { reason } (needs a reason dialog).
  const handleApprove = (organizerId: string) => void organizerId;
  const handleReject = (organizerId: string) => void organizerId;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="mt-1 text-muted">
          Users, organizers and events across EventSphere · last{" "}
          {data.periodDays} days
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        {kpiCards(data.kpis).map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <OrganizerApprovalQueue
        organizers={data.pendingOrganizers}
        total={data.pendingOrganizersTotal}
        viewAllHref={ADMIN_ROUTES.organizers}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <WeeklySignupsChart weeks={data.weeklySignups} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <PlatformBreakdown
            eventsByStatus={data.eventsByStatus}
            accountsByRole={data.accountsByRole}
            usersHref={ADMIN_ROUTES.users}
          />
        </div>
      </div>
    </div>
  );
}
