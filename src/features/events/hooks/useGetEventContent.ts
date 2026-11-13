"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/**
 * Gets the event page's text and images (Strapi) for the content and media steps. A 404 is a
 * final answer (not the caller's event), so it is not retried.
 */
export function useGetEventContent(eventId: string) {
  return useQuery({
    queryKey: eventQueryKeys.content(eventId),
    queryFn: () => eventApiService.getContent(eventId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
