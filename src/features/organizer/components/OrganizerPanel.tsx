import type { ReactNode } from "react";
import { Alert, Button, tabId } from "@/src/core/ui";

/** Header cell classes shared by the three organizer tables. */
export const TH = "px-4 py-2.5 font-semibold";

type OrganizerPanelProps = {
  /** The id the tabs point at (aria-controls). */
  panelId: string;
  /** The selected tab, so the panel is labelled by it. */
  tab: string;
  /** One line saying what the selected list is. */
  description: string;
  /** How many organizers match, once the list has loaded ("4 matching"). */
  summary?: string;
  /** The first load is running: a skeleton is shown instead of the rows. */
  isLoading: boolean;
  /** The load failed and there is nothing to show: the message, with a retry. */
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
};

/**
 * The card under the tabs that shows the selected list. It owns the loading and the error state,
 * so every list fails and loads the same way.
 */
export function OrganizerPanel({
  panelId,
  tab,
  description,
  summary,
  isLoading,
  error,
  onRetry,
  children,
}: OrganizerPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId(panelId, tab)}
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line px-5 py-3 text-sm text-muted">
        <p>{description}</p>
        {summary && <p className="font-medium text-foreground">{summary}</p>}
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <div className="p-5">
          <Alert tone="error" title="We couldn't load the organizers">
            {error}
            <Button variant="secondary" onClick={onRetry} className="mt-3">
              Try again
            </Button>
          </Alert>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading organizers"
      className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
    >
      <div className="h-5 rounded bg-surface-subtle" />
      <div className="h-5 w-11/12 rounded bg-surface-subtle" />
      <div className="h-5 w-3/4 rounded bg-surface-subtle" />
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-muted">{children}</p>;
}
