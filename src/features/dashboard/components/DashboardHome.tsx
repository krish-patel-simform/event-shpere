"use client";

import { useHasPermission } from "@/src/features/auth";
import { ADMIN_OVERVIEW_SAMPLE } from "../utils/admin-overview.sample";
import { AdminOverview } from "./admin/AdminOverview";
import { AttendeeHome } from "./attendee/AttendeeHome";
import {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "./OrganizerReviewStatus";
import { OrganizerHome } from "./organizer/OrganizerHome";
import { SpeakerHome } from "./speaker/SpeakerHome";

/**
 * What /dashboard shows, chosen by permission (never by role name), most powerful first:
 * platform-wide analytics → the admin overview; the analytics of own events → the organizer's
 * home; managing one's own speaker profile → the speaker's home; viewing one's own registrations →
 * the attendee's home. Anyone else gets the organizer review screen.
 */
export function DashboardHome({
  organizerApplication,
}: {
  organizerApplication: OrganizerApplication;
}) {
  const canViewPlatform = useHasPermission("ANALYTICS_VIEW_ALL");
  const canViewOwnEvents = useHasPermission("ANALYTICS_VIEW_EVENT");
  const isSpeaker = useHasPermission("SPEAKER_MANAGE_OWN");
  const hasRegistrations = useHasPermission("REGISTRATION_VIEW_OWN");

  // TODO(API): every home below shows sample data until its endpoints exist.
  if (canViewPlatform) return <AdminOverview data={ADMIN_OVERVIEW_SAMPLE} />;
  if (canViewOwnEvents) return <OrganizerHome />;
  if (isSpeaker) return <SpeakerHome />;
  if (hasRegistrations) return <AttendeeHome />;

  // TODO(API): shown to a person with a pending or rejected organizer application once
  // GET /api/me/organizer-application feeds `organizerApplication`.
  return <OrganizerReviewStatus application={organizerApplication} />;
}
