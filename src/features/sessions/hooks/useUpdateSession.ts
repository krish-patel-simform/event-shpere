"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type {
  SessionDto,
  UpdateSessionRequest,
} from "../schemas/sessions.schemas";
import { invalidateSession } from "./session-cache";

/** Edits or moves a session (the variable is the form's request body). */
export function useUpdateSession(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionDto, ApiError, UpdateSessionRequest>({
    mutationFn: (body) => sessionApiService.update(eventId, sessionId, body),
    // The list, this session's details and the event's pages show the change.
    onSuccess: () => invalidateSession(queryClient, eventId, sessionId),
  });
}
