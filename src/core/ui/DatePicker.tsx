"use client";

import { CalendarDays, CircleAlert } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/style.css";
import "./date-picker.css";
import { fromDateKey, toDateKey } from "../format/date-key";
import { cn } from "./cn";

// A fixed locale, so the server and the browser print the same text.
const SHOWN = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

type DatePickerProps = {
  label: string;
  /** The chosen day as "2026-12-12", or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** For a form library: called when the calendar closes or the field loses focus. */
  onBlur?: () => void;
  /** For a form library: gets the button, so it can move the focus to it on an error. */
  fieldRef?: (element: HTMLButtonElement | null) => void;
  /** The first and the last day that can be chosen ("2026-12-12"); days outside are disabled. */
  min?: string;
  max?: string;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  disabled?: boolean;
  /** Help text under the field; stays visible next to an error. */
  hint?: ReactNode;
  /** Error message; sets aria-invalid and the red style. */
  error?: ReactNode;
  className?: string;
};

/**
 * A date field with a calendar: a button shows the day, and opens a month calendar where days
 * before `min` and after `max` are disabled and cannot be reached. The calendar has month and
 * year drop-downs, so a day years ahead is not a hundred clicks away. Arrow keys move between
 * days, Enter or Space chooses, Esc closes and gives the focus back to the button.
 *
 * The value is the same text a date input holds ("2026-12-12"), so a form keeps it as it kept
 * the input's. It works on calendar days, not instants: the browser's time zone cannot move it.
 */
export function DatePicker({
  label,
  value,
  onChange,
  onBlur,
  fieldRef,
  min,
  max,
  placeholder = "Select a date",
  disabled = false,
  hint,
  error,
  className,
}: DatePickerProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const panelId = `${id}-panel`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const selected = fromDateKey(value) ?? undefined;
  const first = min ? (fromDateKey(min) ?? undefined) : undefined;
  const last = max ? (fromDateKey(max) ?? undefined) : undefined;
  const disabledDays: Matcher[] = [];
  if (first) disabledDays.push({ before: first });
  if (last) disabledDays.push({ after: last });

  function close() {
    setOpen(false);
    onBlur?.();
  }

  function choose(date: Date) {
    onChange(toDateKey(date));
    close();
    button.current?.focus();
  }

  // A click outside the field closes the calendar.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
        onBlur?.();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onBlur]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (open && event.key === "Escape") {
      // Only the calendar closes, not a dialog or a form around it.
      event.preventDefault();
      event.stopPropagation();
      close();
      button.current?.focus();
    }
  }

  // Tabbing out of the field closes the calendar. A click on a disabled day moves the focus to
  // nowhere (no related target) and must not close it.
  function onFocusOut(event: FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      close();
    }
  }

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label id={labelId} htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div
        ref={root}
        onKeyDown={onKeyDown}
        onBlur={onFocusOut}
        className="relative"
      >
        <button
          ref={(element) => {
            button.current = element;
            fieldRef?.(element);
          }}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          // The button's name is the label and the day, so the chosen day is read out too.
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={describedBy}
          onClick={() => (open ? close() : setOpen(true))}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-left text-sm disabled:bg-surface-subtle disabled:text-muted",
            error ? "border-danger" : "border-field",
          )}
        >
          <span id={valueId} className={cn(!selected && "text-muted/70")}>
            {selected ? SHOWN.format(selected) : placeholder}
          </span>
          <CalendarDays
            aria-hidden="true"
            className="size-4 shrink-0 text-muted"
          />
        </button>
        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            className="date-picker absolute z-20 mt-1.5 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-3 shadow-xl"
          >
            <DayPicker
              mode="single"
              required
              selected={selected}
              onSelect={choose}
              defaultMonth={selected ?? first}
              startMonth={first}
              endMonth={last}
              disabled={disabledDays}
              captionLayout="dropdown"
              weekStartsOn={1}
              autoFocus
            />
          </div>
        )}
      </div>
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
