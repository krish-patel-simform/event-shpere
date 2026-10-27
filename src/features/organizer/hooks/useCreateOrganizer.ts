"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { organizerApiService } from "../api/organizer-api.service";
import type {
  CreateOrganizerBody,
  CreateOrganizerResponseDto,
} from "../schemas/organizer.schemas";
import { organizerQueryKeys } from "./useGetOrganizerList";

/** Creates an organizer account (the variable is the form's body). */
export function useCreateOrganizer() {
  const queryClient = useQueryClient();
  return useMutation<CreateOrganizerResponseDto, ApiError, CreateOrganizerBody>(
    {
      // Wrapped, so the service gets only the body (React Query would add a second argument).
      mutationFn: (body) => organizerApiService.create(body),
      // The new organizer shows up in the lists.
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: organizerQueryKeys.all }),
    },
  );
}
