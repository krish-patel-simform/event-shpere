import { cn } from "@/src/core/ui";
import { ALMOST_FULL_PERCENT, fillPercent } from "../utils/event-display";

/**
 * A thin meter of taken seats. It turns amber when nearly full, and always sits next to a text
 * figure, so colour is never the only signal; `label` names it for screen readers.
 */
export function SeatsBar({
  value,
  max,
  label,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  /** Overrides the automatic colour (amber when nearly full). */
  tone?: "brand" | "success";
}) {
  const percent = fillPercent(value, max);
  const fill =
    tone === "success"
      ? "bg-success"
      : percent >= ALMOST_FULL_PERCENT
        ? "bg-warning"
        : "bg-brand";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-surface-subtle"
    >
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
