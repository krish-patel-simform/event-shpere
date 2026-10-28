import { cn } from "@/src/core/ui";
import { formatDayTile, formatMonthTile } from "../utils/home-format";

/** A small calendar tile ("DEC / 3"). Decorative: the full date is always written next to it. */
export function DateTile({
  iso,
  muted = false,
}: {
  /** The date to show; null draws a dashed "TBD" tile for something not scheduled yet. */
  iso: string | null;
  muted?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-14 shrink-0 overflow-hidden rounded-md border text-center",
        iso === null ? "border-dashed border-field" : "border-line",
        muted && "opacity-60",
      )}
    >
      <span className="block bg-surface-subtle py-0.5 text-[11px] font-bold text-danger">
        {iso === null ? "TBD" : formatMonthTile(iso)}
      </span>
      <b className="block pb-1 pt-0.5 text-xl">
        {iso === null ? "–" : formatDayTile(iso)}
      </b>
    </div>
  );
}
