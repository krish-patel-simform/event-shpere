"use client";

import { useQuery } from "@tanstack/react-query";
import {
  venueApiService,
  type ListVenuesParams,
} from "../api/venue-api.service";
import { ALWAYS_FRESH, venueQueryKeys } from "./venue-cache";

/**
 * Gets one page of venues. A new tab, search, sort or page is a new query: it is `isPending`
 * until its own rows arrive, so the page shows the skeleton and never the rows of the previous
 * query (no `placeholderData` on purpose).
 * `alwaysFresh` (Discover): its own cache entry, never reused, so every visit asks the server.
 * `enabled: false` sends nothing until it is true, e.g. a list that needs a state chosen first.
 */
export function useGetVenueList(
  params: ListVenuesParams,
  {
    alwaysFresh = false,
    enabled = true,
  }: { alwaysFresh?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: alwaysFresh
      ? venueQueryKeys.browseList(params)
      : venueQueryKeys.list(params),
    queryFn: () => venueApiService.list(params),
    enabled,
    ...(alwaysFresh ? ALWAYS_FRESH : {}),
  });
}
