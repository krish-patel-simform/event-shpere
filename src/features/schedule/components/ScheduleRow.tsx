import { TriangleAlert } from "lucide-react";
import { Badge, Button, cn } from "@/src/core/ui";
import type { ScheduleItem } from "../types/schedule.types";
import { durationMinutes, formatClock } from "../utils/schedule-time";

/** "Hall B, Level 2 · Talk · with Vikram Mehta": whatever of these the item has. */
function metaLine(item: ScheduleItem): string {
  return [
    item.location,
    item.format,
    item.speakers.length > 0 ? `with ${item.speakers.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * One line of the day: the time, what it is and where, a badge when it is in the schedule, and
 * the button to add or remove it. An overlap is written out ("Overlaps with ..."), not only
 * coloured.
 */
export function ScheduleRow({
  item,
  clashesWith,
  onToggle,
}: {
  item: ScheduleItem;
  /** The sessions in the schedule this one overlaps; empty when there is no clash. */
  clashesWith: readonly ScheduleItem[];
  onToggle: (itemId: string) => void;
}) {
  const isBreak = item.kind === "break";
  const minutes = durationMinutes(item.startsAt, item.endsAt);

  return (
    <li
      className={cn(
        "flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-5 py-4 last:border-b-0",
        item.inSchedule &&
          "bg-brand-soft/40 shadow-[inset_4px_0_0_var(--color-brand)]",
      )}
    >
      <div className="w-20 shrink-0 text-sm">
        <p className={cn("font-semibold", isBreak && "text-muted")}>
          <time dateTime={item.startsAt}>{formatClock(item.startsAt)}</time>
        </p>
        <p className="text-muted">{minutes} min</p>
      </div>

      <div className="min-w-0 flex-1 basis-56 space-y-1">
        <p className={cn("font-semibold", isBreak && "font-medium text-muted")}>
          {item.title}
        </p>
        {metaLine(item) && (
          <p className="text-sm text-muted">{metaLine(item)}</p>
        )}
        {clashesWith.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm font-semibold text-warning">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Overlaps with {clashesWith.map((other) => other.title).join(", ")}
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.speaking && <Badge tone="brand">You are speaking</Badge>}
        {item.kind === "session" &&
          (item.inSchedule ? (
            <>
              <Badge tone="success">In my schedule</Badge>
              <Button
                variant="secondary"
                aria-label={`Remove from my schedule: ${item.title}`}
                onClick={() => onToggle(item.id)}
              >
                Remove
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              aria-label={`Add to my schedule: ${item.title}`}
              onClick={() => onToggle(item.id)}
            >
              Add
            </Button>
          ))}
      </div>
    </li>
  );
}
