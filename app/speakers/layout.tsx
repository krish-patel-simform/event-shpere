import type { ReactNode } from "react";
import { DashboardSession } from "@/src/features/dashboard";

// Speakers are public (Discover → Speakers): a guest sees the shell with log in / sign up, a
// signed-in user sees their own menu. No PermissionGate on the pages; only the Add speaker button
// asks for a permission.
export default function SpeakersLayout({ children }: { children: ReactNode }) {
  return <DashboardSession>{children}</DashboardSession>;
}
