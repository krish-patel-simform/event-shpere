import type { ReactNode } from "react";
import { DashboardSession } from "@/src/features/dashboard";

// The signed-in user comes from GET /api/auth/me (inside DashboardSession). Protecting the
// pages before they render (proxy.ts, AUTH-8) is a separate step.

/** Layout of the signed-in area: side menu, top bar, content. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardSession>{children}</DashboardSession>;
}
