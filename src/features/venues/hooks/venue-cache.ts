import type { QueryClient } from "@tanstack/react-query";
import type { PageMeta } from "../../../core/api-client/base-api.service";
import type { HallAvailabilityRequest } from "../schemas/hall-availability.schemas";
import type {
  VenueDetailDto,
  VenueListItemDto,
} from "../schemas/venue.schemas";
import type { ListVenuesParams } from "../api/venue-api.service";

/** One place for the keys: a change to a venue refreshes `detail(id)` and every list. */
export const venueQueryKeys = {
  all: ["venues"] as const,
  list: (params: ListVenuesParams) => ["venues", "list", params] as const,
  lists: ["venues", "list"] as const,
  detail: (venueId: string) => ["venues", "detail", venueId] as const,
  // Discover's own entries: never shared with the admin pages' cache (see ALWAYS_FRESH).
  browseList: (params: ListVenuesParams) =>
    ["venues", "browse", "list", params] as const,
  browseDetail: (venueId: string) =>
    ["venues", "browse", "detail", venueId] as const,
  // Which halls are free for a time range: one entry per venue and range.
  hallAvailability: (venueId: string, range: HallAvailabilityRequest) =>
    ["venues", "hall-availability", venueId, range] as const,
};

/**
 * Discover never shows a cached answer: each visit (and each search, sort or page) asks the
 * server again and shows the skeleton until it answers, so a venue an admin deactivated in
 * another browser is gone the next time the page loads. gcTime 0 drops the entry as soon as the
 * page stops using it, so nothing is kept to show next time. A page left open still refetches
 * when the visitor comes back to the tab (React Query's refetchOnWindowFocus).
 */
export const ALWAYS_FRESH = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: "always",
} as const;

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

/**
 * After a delete the venue is gone: drop its detail entry (so nothing can show it again, and the
 * page that was showing it does not refetch a 404) and reload the lists.
 */
export function removeVenueFromCache(
  queryClient: QueryClient,
  venueId: string,
) {
  queryClient.removeQueries({ queryKey: venueQueryKeys.detail(venueId) });
  return queryClient.invalidateQueries({ queryKey: venueQueryKeys.lists });
}

/**
 * The venue's row in a list that is already loaded (the page the visitor came from), or
 * undefined. Reads the cache only, never requests: it lets a detail page show the venue's name
 * and address at once while its own request (with the halls) is still running.
 */
export function findListedVenue(
  queryClient: QueryClient,
  venueId: string,
): VenueListItemDto | undefined {
  const lists = queryClient.getQueriesData<{
    items: VenueListItemDto[];
    meta: PageMeta;
  }>({ queryKey: venueQueryKeys.lists });
  for (const [, page] of lists) {
    const venue = page?.items.find((item) => item.id === venueId);
    if (venue) return venue;
  }
  return undefined;
}
