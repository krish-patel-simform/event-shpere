import { cn } from "@/src/core/ui";
import type { KpiTrend } from "./KpiCard";

// The same tones KpiCard uses for its trend line.
const TREND_TONES: Record<KpiTrend["tone"], string> = {
  up: "font-semibold text-success",
  warning: "font-semibold text-warning",
  neutral: "text-muted",
};

/**
 * Same look as KpiCard, for a headline that is not a whole number ("4.4 / 5", "68%"). KpiCard
 * formats its value as a count, so a rating or a percentage needs this one.
 */
export function KpiTextCard({
  label,
  value,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  /** Smaller text after the value ("/ 5"). */
  suffix?: string;
  hint?: KpiTrend;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold">
        {value}
        {suffix && (
          <span className="text-sm font-normal text-muted"> {suffix}</span>
        )}
      </p>
      {hint && (
        <p className={cn("text-xs", TREND_TONES[hint.tone])}>{hint.text}</p>
      )}
    </div>
  );
}
