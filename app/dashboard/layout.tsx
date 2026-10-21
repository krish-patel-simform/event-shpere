import type { ReactNode } from "react";
import { DashboardShell, type DashboardUser } from "@/src/features/dashboard";

// TODO(API): the signed-in user comes from GET /api/auth/me, and these pages are protected
// (AUTH-8). Until then the shell shows this sample user.
const SAMPLE_USER: DashboardUser = { name: "Ananya Rao", roleLabel: "Attendee · organizer pending" };

/** Layout of the signed-in area: side menu, top bar, content. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell user={SAMPLE_USER}>{children}</DashboardShell>;
}
