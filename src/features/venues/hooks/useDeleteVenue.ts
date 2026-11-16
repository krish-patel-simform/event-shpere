"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import { removeVenueFromCache } from "./venue-cache";

/** Deletes a venue that was never used. Call `mutate()` with no variable. */
export function useDeleteVenue(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => venueApiService.delete(venueId),
    onSuccess: () => removeVenueFromCache(queryClient, venueId),
  });
}
