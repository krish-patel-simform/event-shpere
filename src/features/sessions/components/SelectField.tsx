import { CircleAlert } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/src/core/ui";

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & {
  label: string;
  /** Error message; sets aria-invalid and the red style. */
  error?: string;
  hint?: ReactNode;
};

/**
 * Label + select + error, the dropdown twin of TextField (the shared kit has no select yet).
 * `ref` is a normal prop in React 19, so react-hook-form's register() works through it.
 */
export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...selectProps
}: SelectFieldProps) {
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
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...selectProps}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm",
          error ? "border-danger" : "border-field",
        )}
      >
        {children}
      </select>
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
