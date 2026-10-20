import { useId, type ReactNode } from "react";
import { cn } from "./cn";

type FormSectionProps = {
  title: string;
  description?: ReactNode;
  /** `box`: bordered group with the title on the border. `plain`: small caps heading with a rule. */
  variant?: "box" | "plain";
  children: ReactNode;
  className?: string;
};

/** Groups related fields under a heading, so the group is announced as one unit. */
export function FormSection({
  title,
  description,
  variant = "plain",
  children,
  className,
}: FormSectionProps) {
  const headingId = useId();

  if (variant === "box") {
    return (
      <fieldset className={cn("min-w-0 rounded-md border border-line px-4 pb-4", className)}>
        <legend className="px-1.5 text-sm font-semibold">{title}</legend>
        <div className="space-y-3">
          {description && <p className="text-xs text-muted">{description}</p>}
          {children}
        </div>
      </fieldset>
    );
  }

  return (
    // A named group, not a <section>: a form with several headed parts should not add landmarks.
    <div role="group" aria-labelledby={headingId} className={cn("space-y-3", className)}>
      <h2
        id={headingId}
        className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-wider text-muted"
      >
        {title}
      </h2>
      {description && <p className="text-sm text-muted">{description}</p>}
      {children}
    </div>
  );
}
