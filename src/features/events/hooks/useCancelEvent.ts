"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventDto } from "../schemas/events.schemas";
import { invalidateEvent, SESSIONS_QUERY_ROOT } from "./event-cache";

/** Cancels a published event (the variable is the event's id; a list can cancel any row). */
export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation<EventDto, ApiError, string>({
    mutationFn: (eventId) => eventApiService.cancel(eventId),
    onSuccess: (event) =>
      Promise.all([
        // The row moves to the Cancelled tab, so the lists, the counts and the overview are read
        // again.
        invalidateEvent(queryClient, event.id),
        // The server cancelled every session of the event with it (and freed their halls): the
        // Sessions and Halls tabs must not show the old, still-scheduled sessions.
        queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
      ]),
  });
}
