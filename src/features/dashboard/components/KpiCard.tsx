import { cn } from "@/src/core/ui";
import { formatCount } from "@/src/core/format/format-number";

export type KpiTrend = {
  /** Says what changed in words ("▲ 312 new"), so the meaning never depends on colour. */
  text: string;
  tone: "up" | "warning" | "neutral";
};

const TREND_TONES: Record<KpiTrend["tone"], string> = {
  up: "font-semibold text-success",
  warning: "font-semibold text-warning",
  neutral: "text-muted",
};

/** One headline number with its label and an optional trend line under it. */
export function KpiCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: number;
  trend?: KpiTrend;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold">{formatCount(value)}</p>
      {trend && (
        <p className={cn("text-xs", TREND_TONES[trend.tone])}>{trend.text}</p>
      )}
    </div>
  );
}
