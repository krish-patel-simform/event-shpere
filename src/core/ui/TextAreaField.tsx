import { CircleAlert } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

export type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  /** Help text under the box; stays visible next to an error. */
  hint?: ReactNode;
  /** Error message; sets aria-invalid and the red style. */
  error?: string;
};

/**
 * Label + textarea + hint + error, the multi-line twin of TextField.
 * `ref` is a normal prop in React 19, so react-hook-form's register() works through it.
 */
export function TextAreaField({
  label,
  hint,
  error,
  className,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...textareaProps}
        className={cn(
          "w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm placeholder:text-muted/70",
          error ? "border-danger" : "border-field",
        )}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
