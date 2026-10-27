import type { ReactNode } from "react";
import { DashboardSession } from "@/src/features/dashboard";

// The admin pages use the same signed-in shell as /dashboard (side menu, top bar). Who may open
// each page is decided by its PermissionGate; the API checks again.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardSession>{children}</DashboardSession>;
}
