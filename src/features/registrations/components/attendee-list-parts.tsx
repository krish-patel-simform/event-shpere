"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useId } from "react";
import { zonedParts } from "@/src/core/format/format-zoned";
import { Alert, Button, cn } from "@/src/core/ui";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import {
  invalidateAttendees,
  registrationQueryKeys,
} from "../hooks/registration-cache";

// The pieces the event's and the session's attendee lists share, so both look and behave alike.

export const LIST_PAGE_SIZE = 10;
export const LIST_SEARCH_DELAY_MS = 300;
export const TH = "px-4 py-2.5 font-semibold";
export const SELECT_CLASS =
  "rounded-md border border-field bg-surface px-3 py-2.5 text-sm";

export const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "registered", label: "Registered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const CHECKED_IN_OPTIONS = [
  { value: "all", label: "Checked in: any" },
  { value: "yes", label: "Checked in" },
  { value: "no", label: "Pending (not checked in)" },
] as const;

/** The sort options, with the word for what "newest" and "oldest" sort by. */
export function sortOptions(by: "Registered" | "Booked") {
  return [
    { value: "newest", label: `${by}: newest first` },
    { value: "oldest", label: `${by}: oldest first` },
    { value: "name", label: "Name A to Z" },
    { value: "checkedIn", label: "Latest check-in first" },
  ] as const;
}

/** A select with a screen-reader label; only the listed values can come out of it. */
export function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(
            options.find((option) => option.value === event.target.value)
              ?.value ?? options[0]!.value,
          )
        }
        className={SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * "Refresh": asks the server again for everything this event's attendee screens show (the rows
 * AND the count cards, of the event and of its sessions: they share one cache key), so a list
 * left open at the door shows the latest. The rows on screen stay while it loads (same query,
 * fresh data); the icon spins and the button waits. "Updated 10:17" says how old the list is, in
 * the event's zone like every time on these pages. If the refresh fails, the rows on screen stay
 * and the line says plainly that they are the 10:17 ones (`failed`).
 */
export function RefreshButton({
  eventId,
  updatedAt,
  timezone,
  failed = false,
}: {
  eventId: string;
  /** When the rows last came from the server (ms), or 0 if they never have. */
  updatedAt: number;
  timezone: string;
  /** The last refresh failed, but earlier rows are still shown. */
  failed?: boolean;
}) {
  const queryClient = useQueryClient();
  const refreshing =
    useIsFetching({ queryKey: registrationQueryKeys.attendees(eventId) }) > 0;
  const updated =
    updatedAt > 0
      ? zonedParts(new Date(updatedAt).toISOString(), timezone)
      : null;
  const at = updated ? `${updated.hour}:${updated.minute}` : null;

  return (
    <div className="flex items-center gap-2.5 sm:ml-auto">
      <p
        aria-live="polite"
        className={cn(
          "text-sm",
          failed && !refreshing ? "text-danger" : "text-muted",
        )}
      >
        {refreshing
          ? "Refreshing…"
          : failed && at
            ? `Couldn't refresh. Showing the list from ${at}.`
            : at
              ? `Updated ${at}`
              : null}
      </p>
      <Button
        variant="secondary"
        onClick={() => void invalidateAttendees(queryClient, eventId)}
        disabled={refreshing}
      >
        <RefreshCw
          aria-hidden="true"
          className={cn(
            "size-4",
            refreshing && "animate-spin motion-reduce:animate-none",
          )}
        />
        Refresh
      </Button>
    </div>
  );
}

/** The table's skeleton while a page loads. */
export function ListSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="animate-pulse space-y-3 p-5 motion-reduce:animate-none"
    >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-12 rounded bg-surface-subtle" />
      ))}
    </div>
  );
}

/** A failed page: the reason, and "Try again" unless the account may not look (403). */
export function ListError({
  title,
  error,
  forbidden,
  onRetry,
}: {
  title: string;
  error: ApiError;
  /** What to say for a 403, where trying again cannot help. */
  forbidden: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-5">
      <Alert tone="error" title={title}>
        {error.status === 403 ? forbidden : error.message}
        {error.status !== 403 && (
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Alert>
    </div>
  );
}
