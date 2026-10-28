import {
  Ban,
  CalendarX,
  CircleCheck,
  Clock,
  FileText,
  Info,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import type { NotificationType } from "../schemas/notification.schema";
import type {
  NotificationCategory,
  NotificationTone,
  NotificationTypeMeta,
} from "../types/notification";

/**
 * Holding any of these means the person acts on the platform (approves organizers, manages
 * accounts), so they also receive the "platform" notifications. Checked with a permission, never
 * with a role name. The API still decides what it sends.
 */
export const PLATFORM_NOTIFICATION_PERMISSIONS: readonly PermissionCode[] = [
  "ORGANIZER_VERIFY",
  "USER_STATUS_MANAGE",
];

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  NotificationTypeMeta
> = {
  session_confirmed: {
    category: "sessions",
    tone: "success",
    icon: CircleCheck,
    audience: "personal",
  },
  travel_reminder: {
    category: "organizers",
    tone: "warning",
    icon: Clock,
    audience: "personal",
  },
  registrations_milestone: {
    category: "sessions",
    tone: "brand",
    icon: Users,
    audience: "personal",
  },
  co_speaker_accepted: {
    category: "sessions",
    tone: "neutral",
    icon: MessageSquare,
    audience: "personal",
  },
  speaker_guide_updated: {
    category: "organizers",
    tone: "neutral",
    icon: FileText,
    audience: "personal",
  },
  security_sign_in: {
    category: "system",
    tone: "neutral",
    icon: Lock,
    audience: "personal",
  },
  organizer_application: {
    category: "approvals",
    tone: "warning",
    icon: ShieldCheck,
    audience: "platform",
  },
  applications_waiting: {
    category: "approvals",
    tone: "warning",
    icon: Clock,
    audience: "platform",
  },
  invite_expired: {
    category: "users",
    tone: "danger",
    icon: Mail,
    audience: "platform",
  },
  user_suspended: {
    category: "users",
    tone: "danger",
    icon: Ban,
    audience: "platform",
  },
  event_cancelled: {
    category: "events",
    tone: "neutral",
    icon: CalendarX,
    audience: "platform",
  },
  event_sold_out: {
    category: "events",
    tone: "success",
    icon: CircleCheck,
    audience: "platform",
  },
  unverified_accounts: {
    category: "users",
    tone: "brand",
    icon: Users,
    audience: "platform",
  },
  weekly_summary: {
    category: "system",
    tone: "neutral",
    icon: Info,
    audience: "platform",
  },
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  sessions: "Sessions",
  organizers: "Organizers",
  approvals: "Approvals",
  users: "Users",
  events: "Events",
  system: "System",
};

/** Classes of the round icon, per tone. All pairs are soft background + readable text. */
export const TONE_CLASSES: Record<NotificationTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand-soft-foreground",
  neutral: "bg-surface-subtle text-muted",
};
