"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { organizerApiService } from "../api/organizer-api.service";
import type { VerifyOrganizerResponseDto } from "../schemas/organizer.schemas";
import { organizerQueryKeys } from "./useGetOrganizerList";

/** Approves an organizer (the variable is the organizer's id), then refreshes every list. */
export function useVerifyOrganizer() {
  const queryClient = useQueryClient();
  return useMutation<VerifyOrganizerResponseDto, ApiError, string>({
    // Wrapped, so the service gets only the id (React Query would add a second argument).
    mutationFn: (organizerId) => organizerApiService.verify(organizerId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: organizerQueryKeys.all }),
  });
}
