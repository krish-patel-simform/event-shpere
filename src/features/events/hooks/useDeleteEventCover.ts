"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import { invalidateEventContent } from "./event-cache";

/** Removes the cover image. */
export function useDeleteEventCover(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => eventApiService.deleteCover(eventId),
    onSuccess: () => invalidateEventContent(queryClient, eventId),
  });
}
