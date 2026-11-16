"use client";

import { useMemo } from "react";
import { SearchableSelect } from "@/src/core/ui";
import { useGetVenueDetail } from "../../venues";
import type { SessionDto } from "../schemas/sessions.schemas";
import {
  hallFilterOptions,
  type FilterHall,
} from "../utils/session-hall-filter";

type SessionHallFilterProps = {
  /** The event's venue; null while the event has none (then only the sessions' own halls show). */
  venueId: string | null;
  sessions: readonly SessionDto[];
  /** The chosen hall's id, ALL_HALLS ("") or NO_HALL. */
  value: string;
  /** Gets the chosen id and the hall's name (null for "all"), so the page can name it. */
  onChange: (hall: string, name: string | null) => void;
};

/**
 * "Filter by hall": a dropdown of the event's halls you can search by typing. The halls are the
 * event's venue's (GET /api/venues/[id]) plus any hall a session already uses; picking one only
 * narrows the rows already loaded, in the browser, so it needs no request of its own. If the
 * venue's halls cannot load, the halls the sessions use are still offered.
 */
export function SessionHallFilter(props: SessionHallFilterProps) {
  return props.venueId ? (
    <WithVenueHalls {...props} venueId={props.venueId} />
  ) : (
    <HallSelect {...props} halls={[]} />
  );
}

function WithVenueHalls({
  venueId,
  ...rest
}: SessionHallFilterProps & { venueId: string }) {
  const venue = useGetVenueDetail(venueId);
  return <HallSelect {...rest} halls={venue.data?.halls ?? []} />;
}

function HallSelect({
  halls,
  sessions,
  value,
  onChange,
}: Omit<SessionHallFilterProps, "venueId"> & {
  halls: readonly FilterHall[];
}) {
  const options = useMemo(
    () => hallFilterOptions(halls, sessions),
    [halls, sessions],
  );

  return (
    <SearchableSelect
      label="Filter by hall"
      options={options}
      value={value}
      onChange={(hall) =>
        onChange(
          hall,
          options.find((option) => option.value === hall)?.label ?? null,
        )
      }
      emptyOption="All halls"
      placeholder="All halls"
      emptyMessage="No halls yet."
      noMatchMessage="No hall matches your search"
      className="w-full sm:w-72"
    />
  );
}
