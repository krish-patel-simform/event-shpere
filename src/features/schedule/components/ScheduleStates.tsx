import { CalendarPlus } from "lucide-react";
import { Alert, Button } from "@/src/core/ui";

/** Grey blocks where the schedule will be, while it loads. */
export function ScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your schedule"
      className="animate-pulse space-y-4 motion-reduce:animate-none"
    >
      <div className="h-12 rounded-lg bg-surface-subtle" />
      <div className="h-80 rounded-lg bg-surface-subtle" />
    </div>
  );
}

export function ScheduleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert tone="error" title="We couldn't load your schedule">
      {message}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </Alert>
  );
}

/** Nothing added yet: point to the full programme. */
export function ScheduleEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-5 py-12 text-center">
      <CalendarPlus aria-hidden="true" className="size-8 text-muted" />
      <p className="font-semibold">Your schedule is empty</p>
      <p className="max-w-md text-sm text-muted">
        Add the sessions you want to attend from the full programme and they
        show up here, in time order.
      </p>
      <Button onClick={onBrowse} className="mt-2">
        Browse the full programme
      </Button>
    </div>
  );
}
