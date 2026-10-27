"use client";

import { useHasPermission } from "@/src/features/auth";
import { ADMIN_OVERVIEW_SAMPLE } from "../utils/admin-overview.sample";
import { AdminOverview } from "./admin/AdminOverview";
import {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "./OrganizerReviewStatus";

/**
 * What /dashboard shows, chosen by permission (never by role name): platform-wide analytics →
 * the admin overview; everyone else → the organizer review screen for now.
 */
export function DashboardHome({
  organizerApplication,
}: {
  organizerApplication: OrganizerApplication;
}) {
  const canViewPlatform = useHasPermission("ANALYTICS_VIEW_ALL");

  // TODO(API): the admin overview data comes from the admin endpoints once they exist.
  if (canViewPlatform) return <AdminOverview data={ADMIN_OVERVIEW_SAMPLE} />;

  return <OrganizerReviewStatus application={organizerApplication} />;
}
