import type { ReactNode } from "react";
import { DashboardSession } from "@/src/features/dashboard";

// The one signed-in shell (side menu, top bar) for every page in this group: dashboard, admin,
// speakers, profile, notifications, schedule. (app) is a route group, so it is not part of the URL.
// The user comes from GET /api/auth/me inside DashboardSession; a guest sees log in / sign up.
// Who may open each page is decided by its PermissionGate; the API checks again.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <DashboardSession>{children}</DashboardSession>;
}
