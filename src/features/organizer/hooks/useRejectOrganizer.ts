"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { organizerApiService } from "../api/organizer-api.service";
import type {
  RejectOrganizerBody,
  RejectOrganizerResponseDto,
} from "../schemas/organizer.schemas";
import { organizerQueryKeys } from "./useGetOrganizerList";

type RejectVariables = { organizerId: string; body: RejectOrganizerBody };

/** Rejects an organizer with a reason, then refreshes every list. */
export function useRejectOrganizer() {
  const queryClient = useQueryClient();
  return useMutation<RejectOrganizerResponseDto, ApiError, RejectVariables>({
    mutationFn: ({ organizerId, body }) =>
      organizerApiService.reject(organizerId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: organizerQueryKeys.all }),
  });
}
