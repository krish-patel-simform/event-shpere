import type { NotificationDto } from "../schemas/notification.schema";
import type {
  NotificationCategory,
  NotificationFilter,
} from "../types/notification";
import { NOTIFICATION_TYPE_META } from "./notification-types";

// Pure functions over the list, so the page's state logic is easy to test and can move into a
// Redux slice later (each one is a reducer in disguise: (list, input) => new list). None of them
// reads the clock: the caller passes the time.

export function isUnread(notification: NotificationDto): boolean {
  return notification.readAt === null;
}

export function countUnread(list: readonly NotificationDto[]): number {
  return list.filter(isUnread).length;
}

/** Marks one notification as read at `at`. An already-read one keeps its first read time. */
export function markAsRead(
  list: readonly NotificationDto[],
  id: string,
  at: string,
): NotificationDto[] {
  return list.map((item) =>
    item.id === id && isUnread(item) ? { ...item, readAt: at } : item,
  );
}

export function markAllAsRead(
  list: readonly NotificationDto[],
  at: string,
): NotificationDto[] {
  return list.map((item) => (isUnread(item) ? { ...item, readAt: at } : item));
}

export function categoryOf(
  notification: NotificationDto,
): NotificationCategory {
  return NOTIFICATION_TYPE_META[notification.type].category;
}

/** What one tab shows. */
export function filterNotifications(
  list: readonly NotificationDto[],
  filter: NotificationFilter,
): NotificationDto[] {
  if (filter === "all") return [...list];
  if (filter === "unread") return list.filter(isUnread);
  return list.filter((item) => categoryOf(item) === filter);
}

/**
 * Drops the platform-wide notifications for someone who does not handle the platform. The
 * decision (a permission check) is made by the caller; this only applies it.
 */
export function visibleNotifications(
  list: readonly NotificationDto[],
  canSeePlatform: boolean,
): NotificationDto[] {
  return list.filter(
    (item) =>
      canSeePlatform ||
      NOTIFICATION_TYPE_META[item.type].audience === "personal",
  );
}

/** The topic tabs worth showing: the categories that occur in the list, in a fixed order. */
export function categoriesPresent(
  list: readonly NotificationDto[],
  order: readonly NotificationCategory[],
): NotificationCategory[] {
  const present = new Set(list.map(categoryOf));
  return order.filter((category) => present.has(category));
}
