"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/**
 * Gets one event with the figures its overview shows. An event that is not the caller's is a
 * 404, which is a final answer: asking again would not change it, so it is not retried.
 */
export function useGetEventOverview(eventId: string) {
  return useQuery({
    queryKey: eventQueryKeys.overview(eventId),
    queryFn: () => eventApiService.getOverview(eventId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
