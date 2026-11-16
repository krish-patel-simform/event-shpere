"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectOption } from "@/src/core/ui";
import { HallAvailability, useGetHallAvailability } from "../../venues";
import type { HallAvailabilityRequest } from "../../venues";

/**
 * Chooses the hall of a session from the halls of the event's venue that are available for its
 * slot. Which halls those are is asked of the server (never cached: bookings change whenever
 * anyone saves a session), and only once the date and both times make a slot. A new slot is a new
 * question, so the list is never the previous slot's. Under the field, the venue's own list shows
 * every hall with the times it is booked, so the organizer sees why a hall is missing.
 */
export function HallPicker({
  venueId,
  range,
  timezone,
  ownHallId = null,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: {
  venueId: string;
  /** The session's slot; null while the date or times are not filled in. */
  range: HallAvailabilityRequest | null;
  /** The venue's zone: booked times are shown in it. */
  timezone: string;
  /** The hall the saved session already holds (when editing), to say so on that hall. */
  ownHallId?: string | null;
  /** The chosen hall's id, or "". */
  value: string;
  onChange: (hallId: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}) {
  const halls = useGetHallAvailability(venueId, range);

  const options = useMemo<SelectOption[]>(() => {
    const list = halls.data ?? [];
    return (
      list
        // The chosen hall stays listed when the slot changed under it, marked, so the field never
        // shows an empty box for a value it holds.
        .filter((hall) => !hall.busy || hall.id === value)
        .map((hall) => ({
          value: hall.id,
          label: hall.name,
          hint:
            hall.id === ownHallId
              ? `Booked by this session · ${hall.capacity} seats`
              : hall.busy
                ? "Booked at this time"
                : `${hall.capacity} seats`,
        }))
    );
  }, [halls.data, value, ownHallId]);

  const placeholder =
    range === null
      ? "Choose the date and times first"
      : halls.isPending
        ? "Checking halls…"
        : "Choose a hall";

  return (
    <div className="space-y-3">
      <SearchableSelect
        label="Hall"
        options={options}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled || range === null || halls.isPending}
        placeholder={placeholder}
        emptyMessage="No hall is available at this time."
        noMatchMessage="No hall matches your search"
        error={error}
      />
      <HallAvailability venueId={venueId} range={range} timezone={timezone} />
    </div>
  );
}
