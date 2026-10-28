import { BellOff } from "lucide-react";
import { Alert, Button } from "@/src/core/ui";

/** Grey placeholder blocks while the notifications load. */
export function NotificationsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading notifications"
      className="animate-pulse space-y-3 motion-reduce:animate-none"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex gap-3.5 rounded-lg border border-line bg-surface p-5"
        >
          <div className="size-9 shrink-0 rounded-full bg-surface-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-surface-subtle" />
            <div className="h-3 w-1/4 rounded bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The notifications could not be loaded. `onRetry` shows a "Try again" button. */
export function NotificationsError({
  message = "Something went wrong while loading your notifications.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert tone="error" title="We couldn't load your notifications">
      {message}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </Alert>
  );
}

const EMPTY_COPY = {
  none: {
    title: "No notifications yet",
    text: "Updates about your events and account will show up here.",
  },
  unread: {
    title: "You're all caught up",
    text: "There are no unread notifications.",
  },
  category: {
    title: "Nothing here",
    text: "There are no notifications in this category.",
  },
} as const;

export type NotificationsEmptyKind = keyof typeof EMPTY_COPY;

/** Nothing to list: no notifications at all, none unread, or none in the chosen category. */
export function NotificationsEmpty({ kind }: { kind: NotificationsEmptyKind }) {
  const { title, text } = EMPTY_COPY[kind];
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-5 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-surface-subtle text-muted"
      >
        <BellOff className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
