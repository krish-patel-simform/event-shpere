"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import {
  registrationApiService,
  type ListEventAttendeesParams,
} from "../api/registration-api.service";
import { registrationQueryKeys } from "./registration-cache";

/**
 * One page of who registered for an event (route 5), for its organizer or an admin. A new
 * search, filter, day, sort or page is a new query: it is `isPending` until its own rows arrive,
 * so the tab shows the skeleton and never the rows of the previous query (no `placeholderData`).
 */
export function useGetEventAttendees(
  eventId: string,
  params: ListEventAttendeesParams,
) {
  return useQuery<
    Awaited<ReturnType<typeof registrationApiService.listEventAttendees>>,
    ApiError
  >({
    queryKey: registrationQueryKeys.attendeeList(eventId, params),
    queryFn: () => registrationApiService.listEventAttendees(eventId, params),
  });
}
