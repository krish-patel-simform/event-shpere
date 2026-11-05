"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type { SessionCoverDto } from "../schemas/session-content.schemas";
import { invalidateSessionContent, sessionMutationKeys } from "./session-cache";

/** Sets or replaces the cover image (the variable is the chosen file). */
export function useUploadSessionCover(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionCoverDto, ApiError, File>({
    mutationKey: sessionMutationKeys.media(eventId, sessionId),
    mutationFn: (file) =>
      sessionApiService.uploadCover(eventId, sessionId, file),
    // The cover step shows the new cover.
    onSuccess: () => invalidateSessionContent(queryClient, eventId, sessionId),
  });
}
