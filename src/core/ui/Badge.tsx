import type { ComponentProps } from "react";
import { cn } from "./cn";

type BadgeTone =
  | "neutral"
  | "brand"
  | "warning"
  | "success"
  | "danger"
  | "surface"
  | "onPanel";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-subtle text-muted",
  brand: "bg-brand-soft text-brand-soft-foreground",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  /** Solid card colour, for a badge sitting on a tinted image or banner. */
  surface: "border border-line bg-surface text-foreground",
  /** Outline, for the navy brand panel. */
  onPanel: "border border-panel-muted text-panel-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
