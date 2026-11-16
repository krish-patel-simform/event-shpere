"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import { invalidateSessionContent, sessionMutationKeys } from "./session-cache";

/** Removes the cover image. */
export function useDeleteSessionCover(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationKey: sessionMutationKeys.media(eventId, sessionId),
    mutationFn: () => sessionApiService.deleteCover(eventId, sessionId),
    onSuccess: () => invalidateSessionContent(queryClient, eventId, sessionId),
  });
}
