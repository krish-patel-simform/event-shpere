import type { Metadata } from "next";
import { PermissionGate } from "@/src/features/auth";
import {
  DashboardHome,
  type OrganizerApplication,
} from "@/src/features/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// TODO(API): load the signed-in user's application from GET /api/me/organizer-application and
// show this screen while it is pending or rejected. Sample data until then.
const SAMPLE_APPLICATION: OrganizerApplication = {
  status: "pending",
  organisationName: "Acme Events Pvt Ltd",
  website: "https://acme-events.example.com",
  contactName: "Ananya Rao",
  contactEmail: "ananya.rao@example.com",
  submittedAt: "2026-10-20T11:24:00Z",
  emailVerifiedAt: "2026-10-20T11:30:00Z",
};

// Private page: any signed-in user. A guest who opens the URL sees "log in to continue".
// What it shows depends on the user's permissions (DashboardHome).
export default function DashboardPage() {
  return (
    <PermissionGate>
      <DashboardHome organizerApplication={SAMPLE_APPLICATION} />
    </PermissionGate>
  );
}
