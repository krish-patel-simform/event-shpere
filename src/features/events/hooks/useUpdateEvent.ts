"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventDto, UpdateEventRequest } from "../schemas/events.schemas";
import { invalidateEvent } from "./event-cache";

/** Changes an event's details (the variable is the form's request body). */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventDto, ApiError, UpdateEventRequest>({
    mutationFn: (body) => eventApiService.update(eventId, body),
    // The overview, the lists and the tab counts show the change.
    onSuccess: () => invalidateEvent(queryClient, eventId),
  });
}
