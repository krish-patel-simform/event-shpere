"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type {
  CreateSessionRequest,
  SessionDto,
} from "../schemas/sessions.schemas";
import { invalidateSession } from "./session-cache";

/** Adds a session with its speakers to an event (the variable is the form's request body). */
export function useCreateSession(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionDto, ApiError, CreateSessionRequest>({
    // Wrapped, so the service gets only the body (React Query would add a second argument).
    mutationFn: (body) => sessionApiService.create(eventId, body),
    // The new session shows in the list, and the event's session counts and checklist change.
    onSuccess: (session) => invalidateSession(queryClient, eventId, session.id),
  });
}
