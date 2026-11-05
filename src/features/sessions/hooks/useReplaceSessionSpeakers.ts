"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type {
  ReplaceSessionSpeakersRequest,
  SessionDto,
} from "../schemas/sessions.schemas";
import { invalidateSession } from "./session-cache";

/** Replaces who presents a session (the variable is the whole new list of speakers). */
export function useReplaceSessionSpeakers(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionDto, ApiError, ReplaceSessionSpeakersRequest>({
    mutationFn: (body) =>
      sessionApiService.replaceSpeakers(eventId, sessionId, body),
    // The list shows the speakers' names; the details step shows the new list.
    onSuccess: () => invalidateSession(queryClient, eventId, sessionId),
  });
}
