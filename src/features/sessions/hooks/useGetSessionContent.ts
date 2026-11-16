"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import { sessionQueryKeys } from "./session-cache";

/**
 * Gets a session's text and cover (Strapi) for the content and cover steps. A 404 is a final
 * answer (not the caller's session), so it is not retried.
 */
export function useGetSessionContent(eventId: string, sessionId: string) {
  return useQuery({
    queryKey: sessionQueryKeys.content(eventId, sessionId),
    queryFn: () => sessionApiService.getContent(eventId, sessionId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
