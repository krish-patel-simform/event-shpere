"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type { SessionDto } from "../schemas/sessions.schemas";
import { invalidateSession } from "./session-cache";

/**
 * Cancels a session (final). The variable is the session's id, because the list has one hook for
 * all of its rows.
 */
export function useCancelSession(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionDto, ApiError, string>({
    mutationFn: (sessionId) => sessionApiService.cancel(eventId, sessionId),
    // The list shows it cancelled, and the event's session counts change.
    onSuccess: (session) => invalidateSession(queryClient, eventId, session.id),
  });
}
