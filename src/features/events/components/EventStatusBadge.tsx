import { Badge } from "@/src/core/ui";
import type { EventDisplayStatus } from "../types/event-manage.types";
import { EVENT_STATUS_META } from "../utils/event-display";

/** Draft, Published, Completed or Cancelled, always with the word: colour is never the only signal. */
export function EventStatusBadge({ status }: { status: EventDisplayStatus }) {
  const { label, tone } = EVENT_STATUS_META[status];
  return (
    <Badge tone={tone}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
