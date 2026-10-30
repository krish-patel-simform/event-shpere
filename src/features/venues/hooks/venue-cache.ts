import type { QueryClient } from "@tanstack/react-query";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import type { ListVenuesParams } from "../api/venue-api.service";

/** One place for the keys: a change to a venue refreshes `detail(id)` and every list. */
export const venueQueryKeys = {
  all: ["venues"] as const,
  list: (params: ListVenuesParams) => ["venues", "list", params] as const,
  lists: ["venues", "list"] as const,
  detail: (venueId: string) => ["venues", "detail", venueId] as const,
};

/**
 * After a change the server answers with the venue as it is now (halls included), so the open
 * page shows that at once, with no second request. The lists show counts and status, so they
 * are reloaded the next time they are used.
 */
export function applyVenueUpdate(
  queryClient: QueryClient,
  venue: VenueDetailDto,
) {
  queryClient.setQueryData(venueQueryKeys.detail(venue.id), venue);
  return queryClient.invalidateQueries({ queryKey: venueQueryKeys.lists });
}
