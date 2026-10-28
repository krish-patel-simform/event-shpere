import { Badge } from "@/src/core/ui";
import type { PollStatus } from "../types/poll.types";

const BADGES: Record<
  PollStatus,
  { label: string; tone: "success" | "neutral" | "brand" }
> = {
  live: { label: "Live", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  closed: { label: "Closed", tone: "brand" },
};

/** The status is always written out; the colour only backs it up. */
export function PollStatusBadge({ status }: { status: PollStatus }) {
  const { label, tone } = BADGES[status];
  return (
    <Badge tone={tone}>
      {status === "live" && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-success motion-safe:animate-pulse"
        />
      )}
      {label}
    </Badge>
  );
}
