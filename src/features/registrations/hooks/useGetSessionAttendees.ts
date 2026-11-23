"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import {
  registrationApiService,
  type ListSessionAttendeesParams,
} from "../api/registration-api.service";
import { registrationQueryKeys } from "./registration-cache";

/**
 * One page of who holds a seat in one session (route 10), for the event's organizer or an admin.
 * A new search, filter, sort or page is a new query: the list shows the skeleton until its own
 * rows arrive, never the rows of the previous one (no `placeholderData`).
 */
export function useGetSessionAttendees(
  eventId: string,
  sessionId: string,
  params: ListSessionAttendeesParams,
) {
  return useQuery<
    Awaited<ReturnType<typeof registrationApiService.listSessionAttendees>>,
    ApiError
  >({
    queryKey: registrationQueryKeys.sessionAttendeeList(
      eventId,
      sessionId,
      params,
    ),
    queryFn: () =>
      registrationApiService.listSessionAttendees(eventId, sessionId, params),
  });
}
