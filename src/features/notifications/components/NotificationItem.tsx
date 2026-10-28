import Link from "next/link";
import { Badge, cn } from "@/src/core/ui";
import type { NotificationDto } from "../schemas/notification.schema";
import { formatNotificationTime } from "../utils/notification-display";
import { isUnread } from "../utils/notification-state";
import {
  NOTIFICATION_TYPE_META,
  TONE_CLASSES,
} from "../utils/notification-types";

/**
 * One notification, as a list item: its icon, the message, when it came, an optional link to
 * what it is about, and "Mark as read" while it is unread. Unread is shown with the word
 * "Unread" and a tinted row, never colour alone.
 */
export function NotificationItem({
  notification,
  now,
  onMarkAsRead,
}: {
  notification: NotificationDto;
  /** The reference time for "2 hours ago"; passed down so the text never depends on the clock. */
  now: string;
  onMarkAsRead: (id: string) => void;
}) {
  const { icon: Icon, tone } = NOTIFICATION_TYPE_META[notification.type];
  const unread = isUnread(notification);

  return (
    <li
      className={cn(
        "flex items-start gap-3.5 border-b border-line px-5 py-4 last:border-b-0",
        unread && "bg-brand-soft/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words">
          <strong className="font-semibold">{notification.title}</strong>{" "}
          {notification.body}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {unread && <Badge tone="brand">Unread</Badge>}
          <time dateTime={notification.createdAt} className="text-muted">
            {formatNotificationTime(notification.createdAt, now)}
          </time>
          {notification.source && (
            <span className="text-muted">{notification.source}</span>
          )}
          {notification.action && (
            <Link
              href={notification.action.href}
              className="font-semibold text-link hover:underline"
            >
              {notification.action.label}
            </Link>
          )}
          {unread && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              aria-label={`Mark as read: ${notification.title}`}
              className="font-semibold text-link hover:underline"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
