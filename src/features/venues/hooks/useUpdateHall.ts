"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { UpdateHallBody, VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Renames a hall and/or changes its seats (the variable holds only what changed). */
export function useUpdateHall(venueId: string, hallId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, UpdateHallBody>({
    mutationFn: (body) => venueApiService.updateHall(venueId, hallId, body),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
