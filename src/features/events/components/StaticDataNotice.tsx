import type { ReactNode } from "react";
import { Alert, SourceBadge } from "@/src/core/ui";

/**
 * Says plainly that a tab shows example data, because its API does not exist yet. The event's own
 * header (title, dates, venue, counts) above it is real.
 */
export function StaticDataNotice({ children }: { children: ReactNode }) {
  return (
    <Alert tone="info" title="Sample data">
      <span className="flex flex-wrap items-center gap-2">
        <SourceBadge source="static" />
        {children}
      </span>
    </Alert>
  );
}
