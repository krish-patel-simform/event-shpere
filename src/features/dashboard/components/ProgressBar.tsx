import { cn } from "@/src/core/ui";
import { percentOf } from "../utils/home-format";

const FILL_TONES = {
  brand: "bg-brand",
  warning: "bg-warning",
  success: "bg-success",
} as const;

/**
 * A thin meter. It always has a text label next to it in the cards, so colour is never the only
 * signal; `label` names it for screen readers.
 */
export function ProgressBar({
  value,
  max,
  label,
  tone = "brand",
  onPanel = false,
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: keyof typeof FILL_TONES;
  /** Colours for the navy hero panel instead of a card. */
  onPanel?: boolean;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "h-1.5 rounded-full",
        onPanel ? "bg-panel-card" : "bg-surface-subtle",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full",
          onPanel ? "bg-panel-foreground" : FILL_TONES[tone],
        )}
        style={{ width: `${percentOf(value, max)}%` }}
      />
    </div>
  );
}
