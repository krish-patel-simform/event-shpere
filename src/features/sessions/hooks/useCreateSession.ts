"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type {
  CreateSessionRequest,
  SessionDto,
} from "../schemas/sessions.schemas";
import { invalidateSession, sessionQueryKeys } from "./session-cache";

/** Adds a session with its speakers to an event (the variable is the form's request body). */
export function useCreateSession(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionDto, ApiError, CreateSessionRequest>({
    // Wrapped, so the service gets only the body (React Query would add a second argument).
    mutationFn: (body) => sessionApiService.create(eventId, body),
    onSuccess: (session) => {
      // The answer is the whole session as saved: put it where its edit page looks, so that page
      // opens with the session's name and details at once (it still asks the server again).
      queryClient.setQueryData(
        sessionQueryKeys.detail(eventId, session.id),
        session,
      );
      // The new session shows in the list, and the event's session counts and checklist change.
      return invalidateSession(queryClient, eventId, session.id);
    },
  });
}
