import type { ComponentProps } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-70 disabled:hover:bg-brand",
  secondary:
    "border border-field bg-surface text-foreground hover:bg-surface-subtle disabled:text-muted disabled:hover:bg-surface",
};

/**
 * The button look as a class string, so a Next <Link> can look like a button without
 * nesting <a> inside <button>: <Link className={buttonStyles({ variant: "primary" })}>.
 */
export function buttonStyles({
  variant = "primary",
  fullWidth = false,
}: { variant?: Variant; fullWidth?: boolean } = {}): string {
  return cn(base, variants[variant], fullWidth && "w-full");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  fullWidth?: boolean;
  /** Shows a spinner and disables the button; keep the label describing the action in progress. */
  isPending?: boolean;
};

export function Button({
  variant,
  fullWidth,
  isPending = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      className={cn(buttonStyles({ variant, fullWidth }), className)}
      {...props}
    >
      {isPending && <Spinner />}
      {children}
    </button>
  );
}
