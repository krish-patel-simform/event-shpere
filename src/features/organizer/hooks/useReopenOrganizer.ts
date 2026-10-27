"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { organizerApiService } from "../api/organizer-api.service";
import type { ReopenOrganizerResponseDto } from "../schemas/organizer.schemas";
import { organizerQueryKeys } from "./useGetOrganizerList";

/** Puts a rejected application back in the queue (the variable is the organizer's id). */
export function useReopenOrganizer() {
  const queryClient = useQueryClient();
  return useMutation<ReopenOrganizerResponseDto, ApiError, string>({
    // Wrapped, so the service gets only the id (React Query would add a second argument).
    mutationFn: (organizerId) => organizerApiService.reopen(organizerId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: organizerQueryKeys.all }),
  });
}
