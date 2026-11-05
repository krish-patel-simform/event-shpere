"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import { sessionQueryKeys } from "./session-cache";

/**
 * Gets one session for the details and speakers steps. A session that is not in the caller's
 * event is a 404, which is a final answer, so it is not retried.
 */
export function useGetSession(eventId: string, sessionId: string) {
  return useQuery({
    queryKey: sessionQueryKeys.detail(eventId, sessionId),
    queryFn: () => sessionApiService.get(eventId, sessionId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
