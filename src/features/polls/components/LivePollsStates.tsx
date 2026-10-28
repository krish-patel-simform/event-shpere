import { CalendarX } from "lucide-react";
import { Alert, Button } from "@/src/core/ui";

/** Grey blocks where the screen will be, while the sessions and polls load. */
export function LivePollsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading polls"
      className="animate-pulse space-y-4 motion-reduce:animate-none"
    >
      <div className="h-14 rounded-lg bg-surface-subtle" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="h-72 rounded-lg bg-surface-subtle" />
        <div className="h-72 rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}

export function LivePollsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert tone="error" title="We couldn't load your polls">
      {message}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </Alert>
  );
}

/** The speaker has no session to run polls for. */
export function NoPollSessions() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-5 py-12 text-center">
      <CalendarX aria-hidden="true" className="size-8 text-muted" />
      <p className="font-semibold">No sessions to run polls for</p>
      <p className="max-w-md text-sm text-muted">
        Polls and audience questions belong to a session. Once an organizer
        assigns you one, it appears here.
      </p>
    </div>
  );
}
