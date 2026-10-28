import type { NotificationDto } from "../schemas/notification.schema";
import { groupByDay } from "../utils/notification-display";
import { NotificationItem } from "./NotificationItem";

/**
 * The notifications, newest first, in day sections (Today, Yesterday, Earlier this week,
 * Earlier). Each section is a real list under its own heading.
 */
export function NotificationList({
  notifications,
  now,
  idPrefix,
  onMarkAsRead,
}: {
  notifications: readonly NotificationDto[];
  now: string;
  /** Makes the heading ids unique on the page. */
  idPrefix: string;
  onMarkAsRead: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {groupByDay(notifications, now).map((group) => {
        const headingId = `${idPrefix}-group-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="border-b border-line bg-surface-subtle px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {group.label}
            </h2>
            <ul>
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  now={now}
                  onMarkAsRead={onMarkAsRead}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
