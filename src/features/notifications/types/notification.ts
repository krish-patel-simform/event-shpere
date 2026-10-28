import type { LucideIcon } from "lucide-react";

/** The topic tabs. Which of them show depends on what the signed-in person receives. */
export const notificationCategories = [
  "sessions",
  "organizers",
  "approvals",
  "users",
  "events",
  "system",
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

/** A tab of the filter: everything, only what is unread, or one topic. */
export type NotificationFilter = "all" | "unread" | NotificationCategory;

/** The day sections of the list, newest first. */
export type NotificationGroupKey =
  "today" | "yesterday" | "this-week" | "earlier";

/** Colour family of the round icon; each maps to a soft background and its text colour. */
export type NotificationTone =
  "success" | "warning" | "danger" | "brand" | "neutral";

/** One row of the delivery preferences. `push: null` = that channel does not exist for the row. */
export type NotificationPreference = {
  id: string;
  label: string;
  description?: string;
  audience: "personal" | "platform";
  email: boolean;
  push: boolean | null;
};

export type NotificationTypeMeta = {
  category: NotificationCategory;
  tone: NotificationTone;
  icon: LucideIcon;
  /**
   * "platform" notifications concern the whole platform (applications, suspended accounts) and
   * are only shown to someone who holds one of PLATFORM_NOTIFICATION_PERMISSIONS.
   */
  audience: "personal" | "platform";
};
