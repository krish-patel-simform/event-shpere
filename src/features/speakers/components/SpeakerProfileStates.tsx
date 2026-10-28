import type { ReactNode } from "react";
import { Alert, Button } from "@/src/core/ui";

/** The page title, shared by the loading, error and loaded views. */
export function SpeakerProfileTitle({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit my profile</h1>
        <p className="text-muted">
          This information appears on your public speaker page.
        </p>
      </div>
      {children}
    </div>
  );
}

/** Grey blocks where the form will be, while the profile loads. */
export function SpeakerProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SpeakerProfileTitle />
      <div
        role="status"
        aria-label="Loading your profile"
        className="grid animate-pulse gap-5 motion-reduce:animate-none lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-5">
          <div className="h-80 rounded-lg bg-surface-subtle" />
          <div className="h-40 rounded-lg bg-surface-subtle" />
        </div>
        <div className="h-60 rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}

export function SpeakerProfileError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SpeakerProfileTitle />
      <Alert tone="error" title="We couldn't load your profile">
        {message}
        {onRetry && (
          <Button variant="secondary" onClick={onRetry} className="mt-3">
            Try again
          </Button>
        )}
      </Alert>
    </div>
  );
}
