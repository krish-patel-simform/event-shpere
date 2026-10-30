"use client";

import { useQuery } from "@tanstack/react-query";
import { venueApiService } from "../api/venue-api.service";
import { ALWAYS_FRESH, venueQueryKeys } from "./venue-cache";

/**
 * Gets one venue with its halls. Every change to the venue puts the server's answer straight
 * into this query (see applyVenueUpdate), so the page shows the outcome without reloading.
 * `alwaysFresh` (Discover): its own cache entry, never reused, so every visit asks the server
 * (the admin page's copy of the same venue is never shown on Discover).
 */
export function useGetVenueDetail(
  venueId: string,
  { alwaysFresh = false }: { alwaysFresh?: boolean } = {},
) {
  return useQuery({
    queryKey: alwaysFresh
      ? venueQueryKeys.browseDetail(venueId)
      : venueQueryKeys.detail(venueId),
    queryFn: () => venueApiService.get(venueId),
    ...(alwaysFresh ? ALWAYS_FRESH : {}),
  });
}
