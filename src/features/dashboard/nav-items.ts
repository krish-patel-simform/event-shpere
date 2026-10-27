import {
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  User,
  Users,
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

/** Admin pages (the organizers list is built, the rest are not yet); the dashboard links to them too. */
export const ADMIN_ROUTES = {
  organizers: "/admin/organizers",
  users: "/admin/users",
} as const;

/** The profile page of one user (not built yet). `id` = users.id. */
export function adminUserHref(id: string): string {
  return `${ADMIN_ROUTES.users}/${id}`;
}

/** The page where the admin reviews one application (not built yet). `id` = organizer_profiles.id. */
export function adminOrganizerHref(id: string): string {
  return `${ADMIN_ROUTES.organizers}/${id}`;
}

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
    heading: "Manage",
    items: [
      {
        label: "Organizers",
        href: ADMIN_ROUTES.organizers,
        icon: ShieldCheck,
        access: "ORGANIZER_VERIFY",
      },
      {
        label: "Users",
        href: ADMIN_ROUTES.users,
        icon: Users,
        access: "USER_VIEW",
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
