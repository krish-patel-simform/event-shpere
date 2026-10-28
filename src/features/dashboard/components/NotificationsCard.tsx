import Link from "next/link";
import { Card } from "@/src/core/ui";
import type { HomeNotification } from "../types/home-shared";
import { formatRelativeTime } from "../utils/home-format";
import { EmptyState } from "./EmptyState";

/** The latest few notifications; unread ones have a dot (and a hidden word for screen readers). */
export function NotificationsCard({
  title,
  notifications,
  now,
  seeAllHref,
}: {
  title: string;
  notifications: readonly HomeNotification[];
  now: string;
  seeAllHref: string;
}) {
  return (
    <Card
      title={title}
      flush
      action={
        <Link href={seeAllHref} className="text-sm font-semibold text-link">
          See all
        </Link>
      }
    >
      {notifications.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <ul className="px-5">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="flex gap-3 border-b border-line py-3 last:border-b-0"
            >
              {notification.read ? (
                <span aria-hidden="true" className="w-2 shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-2 size-2 shrink-0 rounded-full bg-brand"
                />
              )}
              <div>
                <p className="text-sm">
                  {!notification.read && (
                    <span className="sr-only">Unread: </span>
                  )}
                  {notification.lead && <strong>{notification.lead} </strong>}
                  {notification.message}
                </p>
                <p className="text-xs text-muted">
                  {formatRelativeTime(notification.createdAt, now)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
