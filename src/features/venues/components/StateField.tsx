"use client";

import { CircleAlert } from "lucide-react";
import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/src/core/ui";
import { useGetStateList } from "@/src/features/locations";

/**
 * The state select of the venue form. It shows state names and keeps the chosen name (the API
 * turns it into the state's id). Pass register("state") as `registration`.
 */
export function StateField({
  registration,
  error,
  readOnly,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
  /** While the form is saving: the select cannot change. */
  readOnly?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const states = useGetStateList();
  // The list failing to load is shown here, not as a form error: the rest of the form still works.
  const message =
    error ?? (states.isError ? "Could not load the states." : undefined);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        State
      </label>
      <select
        id={id}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        disabled={states.isPending || states.isError || readOnly}
        {...registration}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm disabled:bg-surface-subtle",
          message ? "border-danger" : "border-field",
        )}
      >
        <option value="">
          {states.isPending ? "Loading states…" : "Choose a state"}
        </option>
        {states.data?.map((state) => (
          <option key={state.id} value={state.name}>
            {state.name}
          </option>
        ))}
      </select>
      {message && (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {message}
            {states.isError && (
              <>
                {" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void states.refetch()}
                >
                  Try again
                </button>
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
