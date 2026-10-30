"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { CreateHallBody, VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Adds a hall to the venue (the variable is the dialog's name and seats). */
export function useAddHall(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, CreateHallBody>({
    mutationFn: (body) => venueApiService.addHall(venueId, body),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
