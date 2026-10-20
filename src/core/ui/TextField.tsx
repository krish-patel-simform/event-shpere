import { CircleAlert } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

export type TextFieldProps = Omit<ComponentProps<"input">, "id" | "size"> & {
  label: string;
  /** Marks the field "(optional)" next to the label. */
  optional?: boolean;
  /** Help text under the input; stays visible next to an error. */
  hint?: ReactNode;
  /** Error message; sets aria-invalid and the red style. */
  error?: string;
  /** Content inside the right edge of the input (e.g. the password Show button). */
  trailing?: ReactNode;
  /** Content on the right of the label row (e.g. "Forgot password?"). */
  labelAction?: ReactNode;
  /** `lg` is the big centred type used for one-time codes. */
  size?: "md" | "lg";
  /**
   * Extra classes for the <input> itself (`className` styles the whole field). Only add classes
   * that do not clash with the built-in ones (e.g. font-mono, text-center), not sizes or colours.
   */
  inputClassName?: string;
};

/**
 * Label + input + hint + error in one place, so no form repeats this markup.
 * `ref` is a normal prop in React 19, so react-hook-form's register() works through it.
 */
export function TextField({
  label,
  optional,
  hint,
  error,
  trailing,
  labelAction,
  size = "md",
  inputClassName,
  className,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
          className={cn(
            "w-full rounded-md border bg-surface px-3 placeholder:text-muted/70 read-only:bg-surface-subtle",
            size === "lg" ? "py-3 text-2xl" : "py-2 text-sm",
            error ? "border-danger" : "border-field",
            trailing ? "pr-16" : undefined,
            inputClassName,
          )}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</div>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
