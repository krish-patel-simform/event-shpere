import type { ReactNode } from "react";
import { formatCount } from "../format/format-number";
import { cn } from "./cn";

/**
 * A count card: a label, one big figure and a line under it. A number is shown with thousands
 * separators; `undefined` shows "—" (still loading, or nothing to count); a string is shown as
 * given ("—", "44%"). `badge` sits next to the label (e.g. a Static badge for a figure with no
 * API yet); `warn` turns the figure amber.
 */
export function Kpi({
  label,
  value,
  note,
  badge,
  warn = false,
}: {
  label: string;
  value: number | string | undefined;
  note: ReactNode;
  badge?: ReactNode;
  warn?: boolean;
}) {
  const shown =
    value === undefined
      ? "—"
      : typeof value === "number"
        ? formatCount(value)
        : value;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {label}
        {badge}
      </p>
      <p className={cn("text-2xl font-semibold", warn && "text-warning")}>
        {shown}
      </p>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}
