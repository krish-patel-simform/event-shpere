"use client";

import { useQuery } from "@tanstack/react-query";
import { organizerApiService } from "../api/organizer-api.service";
import { organizerQueryKeys } from "./useGetOrganizerList";

/**
 * Gets one application for the review page. Every decision (approve, reject, reconsider)
 * invalidates all organizer queries, so this reloads by itself and the page shows the outcome.
 */
export function useGetOrganizerDetail(organizerId: string) {
  return useQuery({
    queryKey: organizerQueryKeys.detail(organizerId),
    queryFn: () => organizerApiService.get(organizerId),
  });
}
