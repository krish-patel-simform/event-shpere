"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventDto } from "../schemas/events.schemas";
import { invalidateEvent } from "./event-cache";

/** Publishes a draft (the variable is the event's id). */
export function usePublishEvent() {
  const queryClient = useQueryClient();
  return useMutation<EventDto, ApiError, string>({
    mutationFn: (eventId) => eventApiService.publish(eventId),
    // The event moves from Draft to Published: the lists, the counts and the overview change.
    onSuccess: (event) => invalidateEvent(queryClient, event.id),
  });
}
