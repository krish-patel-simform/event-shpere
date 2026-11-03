"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectOption } from "@/src/core/ui";
import type { StateDto } from "../schemas/state.schemas";

type StateSelectProps = {
  /** The states to choose from; undefined while they load or when loading failed. */
  states: readonly StateDto[] | undefined;
  isLoading?: boolean;
  /** Loading the states failed: the field is disabled and says so. */
  loadFailed?: boolean;
  /** Adds a "Try again" button to the load error. */
  onRetry?: () => void;
  /** The chosen state's name, or "" for none. */
  value: string;
  onChange: (name: string) => void;
  onBlur?: () => void;
  /** A form error (e.g. "Select a state"). It wins over the load error. */
  error?: string;
  disabled?: boolean;
  label?: string;
};

/**
 * A searchable "State" dropdown that works with state names (the API turns a name into the
 * state's id). The list is short and rarely changes, so it is searched here in the browser, by
 * name or by code ("gj" finds Gujarat). Used by the venue form and the event form.
 */
export function StateSelect({
  states,
  isLoading = false,
  loadFailed = false,
  onRetry,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  label = "State",
}: StateSelectProps) {
  const options = useMemo<SelectOption[]>(
    () =>
      (states ?? []).map((state) => ({
        value: state.name,
        label: state.name,
        // "IN-GJ" → "GJ"
        hint: state.code.replace(/^[A-Z]{2}-/, ""),
      })),
    [states],
  );

  // The load error sits next to the field and does not stop the rest of the form.
  const message =
    error ??
    (loadFailed ? (
      <>
        Could not load the states.
        {onRetry && (
          <>
            {" "}
            <button type="button" className="underline" onClick={onRetry}>
              Try again
            </button>
          </>
        )}
      </>
    ) : undefined);

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={isLoading ? "Loading states…" : "Choose a state"}
      noMatchMessage="No state matches your search"
      disabled={disabled || isLoading || loadFailed}
      error={message}
    />
  );
}
