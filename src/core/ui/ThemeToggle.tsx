"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { applyThemePreference, type ThemePreference } from "../theme/theme";
import { useThemePreference } from "../theme/use-theme-preference";
import { cn } from "./cn";

const OPTIONS: readonly { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "system", label: "System theme", icon: Monitor },
  { value: "dark", label: "Dark theme", icon: Moon },
];

/** Light / System / Dark switch. The choice is saved in the browser and applied at once. */
export function ThemeToggle({ className }: { className?: string }) {
  const current = useThemePreference();

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("inline-flex rounded-md border border-field bg-surface p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => applyThemePreference(value)}
          aria-pressed={current === value}
          aria-label={label}
          title={label}
          className={cn(
            "grid size-7 place-items-center rounded transition-colors",
            current === value
              ? "bg-brand-soft text-brand-soft-foreground"
              : "text-muted hover:bg-surface-subtle hover:text-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}
