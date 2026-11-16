"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn";

export type SelectOption = {
  value: string;
  label: string;
  /** Small text on the right of the row; also searched (e.g. a state code, a city). */
  hint?: string;
};

/**
 * The options whose label or hint contains the text, ignoring case. Those whose label starts
 * with it come first, the rest keep their order.
 */
export function filterOptions(
  options: readonly SelectOption[],
  query: string,
): SelectOption[] {
  const term = query.trim().toLowerCase();
  if (term === "") return [...options];

  const matches = options.filter(
    (option) =>
      option.label.toLowerCase().includes(term) ||
      (option.hint?.toLowerCase().includes(term) ?? false),
  );
  const startsWith = (option: SelectOption) =>
    option.label.toLowerCase().startsWith(term);
  return [
    ...matches.filter(startsWith),
    ...matches.filter((option) => !startsWith(option)),
  ];
}

type SearchableSelectProps = {
  label: string;
  options: readonly SelectOption[];
  /** The chosen option's value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** For a form library: called when the field loses focus. */
  onBlur?: () => void;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  /** A first row that clears the choice (gives ""), e.g. "Choose a venue later". */
  emptyOption?: string;
  /** Shown in the list when there are no options at all. */
  emptyMessage?: string;
  /** Shown in the list when the search matches nothing. */
  noMatchMessage?: string;
  disabled?: boolean;
  /** Help text under the field; stays visible next to an error. */
  hint?: ReactNode;
  /** Error message; sets aria-invalid and the red style. */
  error?: ReactNode;
  className?: string;
};

/**
 * A dropdown you can search: click it (or press ↓) to open the list, type to narrow it, ↑ ↓ to
 * move, Enter to choose, Esc to close. Built as the ARIA "editable combobox with list
 * autocomplete": the input keeps the focus and points at the highlighted row. Filtering happens
 * here, in the browser, so use it for lists that are small and fixed (states); for a list that
 * grows, fetch a filtered page from the server and pass those as `options`.
 */
export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Choose…",
  emptyOption,
  emptyMessage = "Nothing to choose from.",
  noMatchMessage = "No matches",
  disabled = false,
  hint,
  error,
  className,
}: SearchableSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value);
  const matches = useMemo(
    () => filterOptions(options, query),
    [options, query],
  );
  // The "clear" row comes first, and only while nothing is typed: a search narrows to real matches.
  const rows = useMemo<SelectOption[]>(
    () =>
      emptyOption && query.trim() === ""
        ? [{ value: "", label: emptyOption }, ...matches]
        : matches,
    [emptyOption, matches, query],
  );

  function close() {
    setOpen(false);
    setQuery("");
  }

  function openList() {
    if (disabled || open) return;
    setOpen(true);
    // Start on the chosen row, so ↑ ↓ continue from it.
    setActive(
      Math.max(
        rows.findIndex((row) => row.value === value),
        0,
      ),
    );
  }

  function choose(row: SelectOption) {
    onChange(row.value);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.min(index + 1, rows.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.max(index - 1, 0));
        break;
      case "Enter":
        // While the list is open Enter picks a row; it must not also submit the form.
        if (open) {
          event.preventDefault();
          const row = rows[active];
          if (row) choose(row);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  // Keep the highlighted row in view while moving through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({
      block: "nearest",
    });
    // optionId only depends on id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, id]);

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && rows[active] ? optionId(active) : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={open ? query : (selected?.label ?? "")}
          placeholder={open ? "Type to search" : placeholder}
          onClick={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            close();
            onBlur?.();
          }}
          className={cn(
            "w-full rounded-md border bg-surface py-2 pl-3 pr-9 text-sm placeholder:text-muted/70 disabled:bg-surface-subtle disabled:text-muted",
            error ? "border-danger" : "border-field",
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            // Mouse down on the list must not take the focus from the input, or the list would
            // close (blur) before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
          >
            {rows.map((row, index) => (
              <li
                key={row.value === "" ? "__empty" : row.value}
                id={optionId(index)}
                role="option"
                aria-selected={row.value === value}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(row)}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm",
                  index === active && "bg-surface-subtle",
                  row.value === value && "font-semibold",
                )}
              >
                <span>{row.label}</span>
                {row.hint && (
                  <span className="text-xs font-normal text-muted">
                    {row.hint}
                  </span>
                )}
              </li>
            ))}
            {matches.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-sm text-muted">
                {options.length === 0 ? emptyMessage : noMatchMessage}
              </li>
            )}
          </ul>
        )}
      </div>
      <p role="status" className="sr-only">
        {open
          ? `${matches.length} ${matches.length === 1 ? "result" : "results"}`
          : ""}
      </p>
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
