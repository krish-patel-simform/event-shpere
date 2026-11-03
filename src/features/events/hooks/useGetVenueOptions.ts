"use client";

import { useMemo } from "react";
import { useGetVenueList } from "@/src/features/venues";
import type { VenueOption } from "../types/event-manage.types";

/** The server's own cap on a page of venues. */
const VENUE_PAGE_SIZE = 50;

/**
 * The active venues of one state, for the event form's Venue select. The server filters by the
 * state (so only that state's venues travel), and nothing is requested until a state is chosen.
 * A state with more venues than one page would need the server's own `search`; the select
 * searches only what it was given.
 */
export function useGetVenueOptions(stateName: string) {
  const list = useGetVenueList(
    {
      state: stateName,
      status: "active",
      sort: "name",
      pageSize: VENUE_PAGE_SIZE,
    },
    { enabled: stateName !== "" },
  );

  const options = useMemo<VenueOption[]>(
    () =>
      (list.data?.items ?? []).map((venue) => ({
        id: venue.id,
        name: venue.name,
        city: venue.city,
        state: venue.state ?? stateName,
        addressLine: venue.addressLine,
        // Only halls that are on can take sessions.
        hallCount: venue.hallsOn,
        timezone: venue.timezone,
      })),
    [list.data, stateName],
  );

  return {
    options,
    isLoading: stateName !== "" && list.isPending,
    isError: list.isError,
    refetch: () => void list.refetch(),
  };
}
