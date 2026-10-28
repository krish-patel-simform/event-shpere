"use client";

import { CheckCheck } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button, Tabs, tabId, type Tab } from "@/src/core/ui";
import { useHasAnyPermission, useHasPermission } from "@/src/features/auth";
import type { NotificationDto } from "../schemas/notification.schema";
import {
  notificationCategories,
  type NotificationFilter,
} from "../types/notification";
import {
  categoriesPresent,
  countUnread,
  filterNotifications,
  markAllAsRead,
  markAsRead,
  visibleNotifications,
} from "../utils/notification-state";
import {
  CATEGORY_LABELS,
  PLATFORM_NOTIFICATION_PERMISSIONS,
} from "../utils/notification-types";
import {
  NOTIFICATION_PREFERENCES_SAMPLE,
  NOTIFICATIONS_SAMPLE,
  NOTIFICATIONS_SAMPLE_NOW,
} from "../utils/notifications.sample";
import { NotificationList } from "./NotificationList";
import { NotificationPreferences } from "./NotificationPreferences";
import {
  NotificationsEmpty,
  NotificationsError,
  NotificationsSkeleton,
} from "./NotificationStates";

type NotificationsProps = {
  /** The notifications to show. The sample until the API is wired. */
  initialNotifications?: readonly NotificationDto[];
  /** The reference "now" for grouping and "2 hours ago". A prop so the output is deterministic. */
  now?: string;
  /** Which view to show; the API's loading / error state will drive this later. */
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
};

/**
 * The notification center, the same page for every role: the list in day sections with an
 * unread marker, the All / Unread / topic tabs, "Mark all as read" and, with
 * NOTIFICATION_MANAGE, the delivery preferences. Platform-wide notifications (organizer
 * applications, suspended accounts) show only for someone who may act on them. Read / unread is
 * local state for now (see notification-state.ts); it will move to the API.
 */
export function Notifications({
  initialNotifications = NOTIFICATIONS_SAMPLE,
  now = NOTIFICATIONS_SAMPLE_NOW,
  status = "ready",
  onRetry,
}: NotificationsProps) {
  if (status === "loading") {
    return (
      <PageFrame>
        <NotificationsSkeleton />
      </PageFrame>
    );
  }
  if (status === "error") {
    return (
      <PageFrame>
        <NotificationsError onRetry={onRetry} />
      </PageFrame>
    );
  }
  return <NotificationCenter initial={initialNotifications} now={now} />;
}

/** The title, shared by the loading, error and loaded views. */
function PageFrame({
  actions,
  summary,
  children,
}: {
  actions?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-muted">
            Updates and activity that need your attention.
          </p>
          {summary}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function NotificationCenter({
  initial,
  now,
}: {
  initial: readonly NotificationDto[];
  now: string;
}) {
  const panelId = useId();
  const [notifications, setNotifications] = useState(initial);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const canSeePlatform = useHasAnyPermission(PLATFORM_NOTIFICATION_PERMISSIONS);
  const canManage = useHasPermission("NOTIFICATION_MANAGE");

  const visible = visibleNotifications(notifications, canSeePlatform);
  const unread = countUnread(visible);

  const tabs: Tab<NotificationFilter>[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", tone: "brand" },
    ...categoriesPresent(visible, notificationCategories).map((category) => ({
      key: category,
      label: CATEGORY_LABELS[category],
    })),
  ];
  // A topic tab can disappear (the person lost a permission): fall back to everything.
  const active = tabs.some((tab) => tab.key === filter) ? filter : "all";
  const shown = filterNotifications(visible, active);

  const readNow = () => new Date().toISOString();
  const onMarkAsRead = (id: string) =>
    setNotifications((list) => markAsRead(list, id, readNow()));
  const onMarkAllAsRead = () =>
    setNotifications((list) => markAllAsRead(list, readNow()));

  const emptyKind =
    visible.length === 0 ? "none" : active === "unread" ? "unread" : "category";

  return (
    <PageFrame
      summary={
        <p role="status" className="mt-1 text-sm font-medium">
          {unread === 0
            ? "You're all caught up."
            : `${unread} unread ${unread === 1 ? "notification" : "notifications"}`}
        </p>
      }
      actions={
        <Button
          variant="secondary"
          onClick={onMarkAllAsRead}
          disabled={unread === 0}
        >
          <CheckCheck aria-hidden="true" className="size-4" />
          Mark all as read
        </Button>
      }
    >
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Tabs
            label="Filter notifications"
            tabs={tabs}
            counts={{ unread }}
            value={active}
            onChange={setFilter}
            panelId={panelId}
          />
          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(panelId, active)}
          >
            {shown.length === 0 ? (
              <NotificationsEmpty kind={emptyKind} />
            ) : (
              <NotificationList
                notifications={shown}
                now={now}
                idPrefix={panelId}
                onMarkAsRead={onMarkAsRead}
              />
            )}
          </div>
        </div>
        {canManage && (
          <NotificationPreferences
            preferences={NOTIFICATION_PREFERENCES_SAMPLE.filter(
              (preference) =>
                canSeePlatform || preference.audience === "personal",
            )}
          />
        )}
      </div>
    </PageFrame>
  );
}
