"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import { sessionQueryKeys } from "./session-cache";

/**
 * Gets one session's public page. A session that is not public is a 404 (or a 400 for a badly
 * formed id), which is a final answer, so it is not retried.
 */
export function useGetPublicSession(slug: string, sessionId: string) {
  return useQuery({
    queryKey: sessionQueryKeys.publicDetail(slug, sessionId),
    queryFn: () => sessionApiService.getPublic(slug, sessionId),
    retry: (failureCount, error) =>
      !(
        error instanceof ApiError &&
        (error.status === 404 || error.status === 400)
      ) && failureCount < 2,
  });
}
