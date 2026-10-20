import { CalendarCheck } from "lucide-react";
import { cn } from "./cn";

/** `onPanel` is for the navy brand panel; the default is for light/dark page backgrounds. */
export function Logo({ onPanel = false, className }: { onPanel?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-lg",
          onPanel ? "bg-white text-panel" : "bg-brand text-brand-foreground",
        )}
      >
        <CalendarCheck aria-hidden="true" className="size-5" />
      </span>
      <span className={cn("text-lg font-semibold", onPanel && "text-panel-foreground")}>
        EventSphere
      </span>
    </span>
  );
}
