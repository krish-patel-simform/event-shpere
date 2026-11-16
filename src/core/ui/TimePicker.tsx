"use client";

import { CircleAlert, Clock } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { formatTime12, fromMinutes, toMinutes } from "../format/time-key";
import { cn } from "./cn";

type TimePickerProps = {
  label: string;
  /** The chosen time as "09:30" (24 hours), or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** For a form library: called when the field loses focus. */
  onBlur?: () => void;
  /** For a form library: gets the button, so it can move the focus to it on an error. */
  fieldRef?: (element: HTMLButtonElement | null) => void;
  /**
   * The earliest time that can be chosen, "HH:mm" (earlier times are shown but disabled). Leave
   * it out, or "00:00", for no limit. Null means no time can be chosen at all.
   */
  min?: string | null;
  /** The gap between the times offered, in minutes. */
  step?: number;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  disabled?: boolean;
  /** Help text under the field; stays visible next to an error. */
  hint?: ReactNode;
  /** Error message; sets the red style. */
  error?: ReactNode;
  className?: string;
};

type Slot = { time: string; enabled: boolean };

/** Every time of the day `step` minutes apart, each marked usable or not by `min`. */
function slotsFor(step: number, min: string | null | undefined): Slot[] {
  const earliest =
    min === undefined ? 0 : min === null ? Infinity : toMinutes(min);
  const slots: Slot[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    slots.push({
      time: fromMinutes(minutes),
      enabled: minutes >= (earliest ?? 0),
    });
  }
  return slots;
}

/**
 * A time field with a list of times: a button shows the time, and opens a list of every `step`
 * minutes of the day. Times before `min` are listed but disabled, so it is clear why they can not
 * be chosen. ↑ ↓ move between the usable times, Home and End jump to the first and the last,
 * Enter or Space chooses, Esc closes. Built as the ARIA "select-only combobox": the button keeps
 * the focus and points at the highlighted time.
 *
 * The value is the same text a time input holds ("09:30", 24 hours), so a form keeps it as it
 * kept the input's; the list reads it out as "9:30 AM".
 */
export function TimePicker({
  label,
  value,
  onChange,
  onBlur,
  fieldRef,
  min,
  step = 15,
  placeholder = "Select a time",
  disabled = false,
  hint,
  error,
  className,
}: TimePickerProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const slots = useMemo(() => slotsFor(step, min), [step, min]);
  const firstEnabled = slots.findIndex((slot) => slot.enabled);
  const lastEnabled = slots.findLastIndex((slot) => slot.enabled);

  function close() {
    setOpen(false);
  }

  function openList() {
    if (disabled || open) return;
    // Start on the chosen time; else on 09:00 if it is usable (a good place to start for an
    // event); else on the first usable time.
    const chosen = slots.findIndex(
      (slot) => slot.time === value && slot.enabled,
    );
    const nine = slots.findIndex(
      (slot) => slot.time === "09:00" && slot.enabled,
    );
    setActive(
      chosen >= 0 ? chosen : nine >= 0 ? nine : Math.max(firstEnabled, 0),
    );
    setOpen(true);
  }

  function choose(index: number) {
    const slot = slots[index];
    if (!slot?.enabled) return;
    onChange(slot.time);
    close();
  }

  /** The nearest usable time from `from` in the direction `by` (1 or -1), or `from` itself. */
  function usableFrom(from: number, by: 1 | -1): number {
    for (
      let index = from + by;
      index >= 0 && index < slots.length;
      index += by
    ) {
      if (slots[index].enabled) return index;
    }
    return from;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else
          setActive((index) =>
            usableFrom(index, event.key === "ArrowDown" ? 1 : -1),
          );
        break;
      case "Home":
      case "End":
        if (open) {
          event.preventDefault();
          setActive(event.key === "Home" ? firstEnabled : lastEnabled);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else openList();
        break;
      case "Escape":
        if (open) {
          // Only the list closes, not a dialog or a form around it.
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        break;
    }
  }

  // Keep the highlighted time in view while moving through the day.
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
  const noneLeft = firstEnabled === -1;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label id={labelId} htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <button
          ref={fieldRef}
          id={id}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? optionId(active) : undefined}
          // The button's name is the label and the time, so the chosen time is read out too.
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={describedBy}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          onBlur={() => {
            close();
            onBlur?.();
          }}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 text-left text-sm disabled:bg-surface-subtle disabled:text-muted",
            error ? "border-danger" : "border-field",
          )}
        >
          <span id={valueId} className={cn(!value && "text-muted/70")}>
            {value ? formatTime12(value) : placeholder}
          </span>
          <Clock aria-hidden="true" className="size-4 shrink-0 text-muted" />
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            // Mouse down on the list must not take the focus from the button, or the list would
            // close (blur) before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
          >
            {slots.map((slot, index) => (
              <li
                key={slot.time}
                id={optionId(index)}
                role="option"
                aria-selected={slot.time === value}
                aria-disabled={!slot.enabled || undefined}
                onMouseEnter={() => slot.enabled && setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "px-3 py-2 text-sm",
                  slot.enabled
                    ? "cursor-pointer"
                    : "cursor-not-allowed text-muted/50",
                  slot.enabled && index === active && "bg-surface-subtle",
                  slot.time === value && "font-semibold",
                )}
              >
                {formatTime12(slot.time)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {noneLeft && <p className="text-xs text-muted">No time can be chosen.</p>}
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
