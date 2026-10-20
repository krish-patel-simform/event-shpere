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

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavSection = { heading?: string; items: readonly NavItem[] };

/**
 * The signed-in app's side menu. Pages other than the dashboard are built in later weeks;
 * their links already point at the final paths.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    heading: "Discover",
    items: [
      { label: "Browse events", href: "/events", icon: CalendarDays },
      { label: "Speakers", href: "/speakers", icon: User },
    ],
  },
  {
    heading: "My activity",
    items: [
      { label: "My events", href: "/my-events", icon: Ticket },
      { label: "My schedule", href: "/my-schedule", icon: Clock },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Profile & settings", href: "/profile", icon: SlidersHorizontal },
    ],
  },
];
