"use client";

import { useQuery } from "@tanstack/react-query";
import {
  venueApiService,
  type ListVenuesParams,
} from "../api/venue-api.service";
import { venueQueryKeys } from "./venue-cache";

/**
 * Gets one page of venues. A new tab, search, sort or page is a new query: it is `isPending`
 * until its own rows arrive, so the page shows the skeleton and never the rows of the previous
 * query (no `placeholderData` on purpose).
 */
export function useGetVenueList(params: ListVenuesParams) {
  return useQuery({
    queryKey: venueQueryKeys.list(params),
    queryFn: () => venueApiService.list(params),
  });
}
