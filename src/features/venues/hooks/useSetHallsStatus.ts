"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type {
  SetHallsStatusBody,
  VenueDetailDto,
} from "../schemas/venue.schemas";
import { applyVenueUpdate } from "./venue-cache";

/** Activates or deactivates halls of the venue (the variable names which: "all" or a list of hall ids). */
export function useSetHallsStatus(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation<VenueDetailDto, ApiError, SetHallsStatusBody>({
    mutationFn: (body) => venueApiService.setHallsStatus(venueId, body),
    onSuccess: (venue) => applyVenueUpdate(queryClient, venue),
  });
}
