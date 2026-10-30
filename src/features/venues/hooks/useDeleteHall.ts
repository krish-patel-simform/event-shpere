"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Deletes a hall of the venue (the variable is the hall's id). */
export function useDeleteHall(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, string>({
    mutationFn: (hallId) => venueApiService.deleteHall(venueId, hallId),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
