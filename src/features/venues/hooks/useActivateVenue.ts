"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/**
 * Activates the venue again. The variable says what happens to its halls: "none" keeps them all
 * inactive (the admin activates them one by one), "all" activates every hall.
 */
export function useActivateVenue(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, "all" | "none">({
    mutationFn: (activateHalls) =>
      venueApiService.setStatus(venueId, { isActive: true, activateHalls }),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
