"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Deactivates the venue; the server deactivates all its halls too. Call `mutate()` with no variable. */
export function useDeactivateVenue(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, void>({
    mutationFn: () =>
      venueApiService.setStatus(venueId, {
        isActive: false,
        activateHalls: "none",
      }),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
