"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { UpdateVenueBody, VenueDetailDto } from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Edits the venue's details (the variable holds only the fields that changed). */
export function useUpdateVenue(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, UpdateVenueBody>({
    mutationFn: (body) => venueApiService.update(venueId, body),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
