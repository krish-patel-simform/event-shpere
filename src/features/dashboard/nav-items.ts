import {
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  User,
  UserCog,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { NOTIFICATION_ROUTES } from "@/src/features/notifications";
import { ORGANIZER_ROUTES } from "@/src/features/organizer";
import { POLL_ROUTES } from "@/src/features/polls";
import { PROFILE_ROUTES } from "@/src/features/profile";
import { SCHEDULE_ROUTES } from "@/src/features/schedule";
import { SESSION_ROUTES } from "@/src/features/sessions";
import { SPEAKER_PROFILE_ROUTE } from "@/src/features/speakers";
import { USER_ROUTES } from "@/src/features/users";

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
 * Admin pages the dashboard links to. Each path belongs to its feature (ORGANIZER_ROUTES,
 * USER_ROUTES), so a page is renamed in one place; this only gathers them for the menu and the
 * admin overview.
 */
export const ADMIN_ROUTES = {
  organizers: ORGANIZER_ROUTES.list,
  users: USER_ROUTES.list,
} as const;

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
        href: SCHEDULE_ROUTES.mine,
        icon: Clock,
        access: "SCHEDULE_MANAGE",
      },
    ],
  },
  {
    // Speaker workspace: each link needs a permission only the speaker role has.
    heading: "Speaking",
    items: [
      {
        label: "My sessions",
        href: SESSION_ROUTES.list,
        icon: Mic,
        access: "SPEAKER_MANAGE_OWN",
      },
      {
        label: "Live polls & Q&A",
        href: POLL_ROUTES.list,
        icon: Vote,
        access: "POLL_CREATE_ASSIGNED",
      },
      {
        label: "Edit my profile",
        href: SPEAKER_PROFILE_ROUTE,
        icon: UserCog,
        access: "SPEAKER_MANAGE_OWN",
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
        href: NOTIFICATION_ROUTES.list,
        icon: Bell,
        access: "NOTIFICATION_VIEW",
      },
      {
        label: "Profile & settings",
        href: PROFILE_ROUTES.settings,
        icon: SlidersHorizontal,
        access: "PROFILE_VIEW",
      },
    ],
  },
];
