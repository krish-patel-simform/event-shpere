"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import { sessionQueryKeys } from "./session-cache";

/**
 * Gets every session of an event, earliest first. An event that is not the caller's is a 404,
 * which is a final answer: asking again would not change it, so it is not retried.
 */
export function useGetEventSessions(eventId: string) {
  return useQuery({
    queryKey: sessionQueryKeys.list(eventId),
    queryFn: () => sessionApiService.listForEvent(eventId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
