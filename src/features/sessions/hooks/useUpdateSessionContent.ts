"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type {
  SessionContentDto,
  UpdateSessionContentRequest,
} from "../schemas/session-content.schemas";
import { invalidateSessionContent, sessionQueryKeys } from "./session-cache";

/** Saves a session's text (the variable is the body of PATCH .../content). */
export function useUpdateSessionContent(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionContentDto, ApiError, UpdateSessionContentRequest>({
    mutationFn: (body) =>
      sessionApiService.updateContent(eventId, sessionId, body),
    onSuccess: (content) => {
      // The answer is the whole content as saved: put it in the cache so the step shows it at once.
      queryClient.setQueryData(
        sessionQueryKeys.content(eventId, sessionId),
        content,
      );
      return invalidateSessionContent(queryClient, eventId, sessionId);
    },
  });
}
