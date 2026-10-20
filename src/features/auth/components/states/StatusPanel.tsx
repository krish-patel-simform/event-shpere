import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/src/core/ui";

type StatusPanelProps = {
  icon: LucideIcon;
  /** Colour of the round icon: `brand` (neutral), `success`, or `danger`. */
  tone?: "brand" | "success" | "danger";
  title: string;
  /** The explanation under the title. */
  children?: ReactNode;
  /** Buttons or links under the text. */
  actions?: ReactNode;
};

const TONES = {
  brand: "bg-brand-soft text-brand-soft-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
} as const;

/**
 * A centred "something happened" block: icon, title, text, buttons. Used for end states of an
 * auth flow, e.g. "Email verified" or "This link is invalid or has expired". The title is the
 * page's <h1>.
 */
export function StatusPanel({ icon: Icon, tone = "brand", title, children, actions }: StatusPanelProps) {
  return (
    <div className="space-y-3 text-center">
      <span className={cn("mx-auto grid size-14 place-items-center rounded-full", TONES[tone])}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <div className="text-muted">{children}</div>}
      {actions && <div className="flex flex-col items-stretch gap-3 pt-3 sm:flex-row sm:justify-center">{actions}</div>}
    </div>
  );
}
