"use client";

import { useQuery } from "@tanstack/react-query";
import { venueApiService } from "../api/venue-api.service";
import { venueQueryKeys } from "./venue-cache";

/**
 * Gets one venue with its halls. Every change to the venue puts the server's answer straight
 * into this query (see applyVenueUpdate), so the page shows the outcome without reloading.
 */
export function useGetVenueDetail(venueId: string) {
  return useQuery({
    queryKey: venueQueryKeys.detail(venueId),
    queryFn: () => venueApiService.get(venueId),
  });
}
