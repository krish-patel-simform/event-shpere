"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { CreateVenueBody, CreateVenueDto } from "../schemas/venue.schemas";
import { venueQueryKeys } from "./venue-cache";

/** Creates a venue with its halls (the variable is the form's body). */
export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation<CreateVenueDto, ApiError, CreateVenueBody>({
    // Wrapped, so the service gets only the body (React Query would add a second argument).
    mutationFn: (body) => venueApiService.create(body),
    // The new venue shows up in the lists.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: venueQueryKeys.all }),
  });
}
