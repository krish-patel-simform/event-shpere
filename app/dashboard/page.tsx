import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import {
  OrganizerReviewStatus,
  type OrganizerApplication,
} from "@/src/features/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// TODO(API): load the signed-in user's application (organizer profile) and show this screen
// only while it is pending. Sample data until then.
const SAMPLE_APPLICATION: OrganizerApplication = {
  organisationName: "Acme Events Pvt Ltd",
  website: "https://acme-events.example.com",
  contactName: "Ananya Rao",
  contactEmail: "ananya.rao@example.com",
  submittedAt: "2026-10-20T11:24:00Z",
  emailVerifiedAt: "2026-10-20T11:30:00Z",
};

// Private page: any signed-in user. A guest who opens the URL sees "log in to continue".
export default function DashboardPage() {
  return (
    <PermissionGate>
      <OrganizerReviewStatus application={SAMPLE_APPLICATION} />
    </PermissionGate>
  );
}
