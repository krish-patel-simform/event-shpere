import {
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  SlidersHorizontal,
  Ticket,
  User,
  type LucideIcon,
} from "lucide-react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";

/**
 * Who sees a menu link: "public" (guests too), "signed-in" (any account) or one permission code.
 * Required, so every new link has to say who it is for. Hiding a link is not protection: the
 * page has its own PermissionGate and the API checks again.
 */
export type NavAccess = "public" | "signed-in" | PermissionCode;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  access: NavAccess;
};
export type NavSection = { heading?: string; items: readonly NavItem[] };

/**
 * The app's side menu. Pages other than the dashboard are built in later weeks; their links
 * already point at the final paths.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        access: "signed-in",
      },
    ],
  },
  {
    heading: "Discover",
    items: [
      {
        label: "Browse events",
        href: "/events",
        icon: CalendarDays,
        access: "public",
      },
      { label: "Speakers", href: "/speakers", icon: User, access: "public" },
    ],
  },
  {
    heading: "My activity",
    items: [
      {
        label: "My events",
        href: "/my-events",
        icon: Ticket,
        access: "REGISTRATION_VIEW_OWN",
      },
      {
        label: "My schedule",
        href: "/my-schedule",
        icon: Clock,
        access: "SCHEDULE_MANAGE",
      },
    ],
  },
  {
    heading: "Account",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        access: "NOTIFICATION_VIEW",
      },
      {
        label: "Profile & settings",
        href: "/profile",
        icon: SlidersHorizontal,
        access: "PROFILE_VIEW",
      },
    ],
  },
];
