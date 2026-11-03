"use client";

import { Alert, Badge, Button } from "@/src/core/ui";
import { useGetHallAvailability } from "../hooks/useGetHallAvailability";
import type {
  HallAvailabilityDto,
  HallAvailabilityRequest,
} from "../schemas/hall-availability.schemas";
import { formatSlot } from "../utils/hall-slot";

/** How many booked times a hall lists before "+ N more". */
const SLOTS_SHOWN = 3;

type HallAvailabilityProps = {
  venueId: string;
  /** The time range to check; null while the dates are not filled in (or not valid). */
  range: HallAvailabilityRequest | null;
  /** The venue's zone: the booked times are shown in it. */
  timezone: string;
};

/**
 * Which halls of the venue are free for the event's dates: each hall is "Free" or lists when it
 * is booked, and a line says how many are completely free. A hall booked for only a part of the
 * range is not free but can still take sessions at other times, so "none free" is a warning,
 * not an error. The times are all this shows: never what is booked or by whom.
 */
export function HallAvailability({
  venueId,
  range,
  timezone,
}: HallAvailabilityProps) {
  const halls = useGetHallAvailability(venueId, range);

  if (range === null) {
    return (
      <p className="text-sm text-muted">
        Choose the start and end dates to see which halls are free.
      </p>
    );
  }

  if (halls.isPending) {
    return (
      <div
        role="status"
        aria-label="Checking which halls are free"
        className="animate-pulse space-y-2 motion-reduce:animate-none"
      >
        <div className="h-4 w-56 rounded bg-surface-subtle" />
        <div className="h-10 rounded-md bg-surface-subtle" />
        <div className="h-10 rounded-md bg-surface-subtle" />
      </div>
    );
  }

  if (halls.isError) {
    return (
      <Alert tone="error" title="We couldn't check the halls">
        <p>{halls.error.message}</p>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => void halls.refetch()}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  const free = halls.data.filter((hall) => !hall.busy).length;
  const total = halls.data.length;

  if (total === 0) {
    return (
      <p className="text-sm text-muted">This venue has no halls switched on.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" role="status">
        {free} of {total} {total === 1 ? "hall is" : "halls are"} completely
        free on these dates.
      </p>
      {free === 0 && (
        <Alert tone="warning">
          No hall is completely free on these dates. A hall that is only partly
          booked can still take sessions at the times it is free.
        </Alert>
      )}
      <ul
        aria-label="Halls and their availability"
        className="divide-y divide-line rounded-md border border-line"
      >
        {halls.data.map((hall) => (
          <HallRow key={hall.id} hall={hall} timezone={timezone} />
        ))}
      </ul>
    </div>
  );
}

function HallRow({
  hall,
  timezone,
}: {
  hall: HallAvailabilityDto;
  timezone: string;
}) {
  const shown = hall.bookedSlots.slice(0, SLOTS_SHOWN);
  const more = hall.bookedSlots.length - shown.length;

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
      <div>
        <p className="font-semibold">{hall.name}</p>
        <p className="text-xs text-muted">{hall.capacity} seats</p>
      </div>
      {hall.busy ? (
        <div className="space-y-1 text-right">
          <Badge tone="warning">Booked</Badge>
          <ul
            className="text-xs text-muted"
            aria-label={`${hall.name} is booked`}
          >
            {shown.map((slot) => (
              <li key={slot.startAt}>
                {formatSlot(slot.startAt, slot.endAt, timezone)}
              </li>
            ))}
            {more > 0 && <li>+ {more} more</li>}
          </ul>
        </div>
      ) : (
        <Badge tone="success">Free</Badge>
      )}
    </li>
  );
}
