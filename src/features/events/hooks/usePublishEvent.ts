"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventDto, PublishEventRequest } from "../schemas/events.schemas";
import { invalidateEvent } from "./event-cache";

/** Publishes a draft. The variable is the event's id and the dates registration opens and closes. */
export function usePublishEvent() {
  const queryClient = useQueryClient();
  return useMutation<
    EventDto,
    ApiError,
    { eventId: string; body: PublishEventRequest }
  >({
    mutationFn: ({ eventId, body }) => eventApiService.publish(eventId, body),
    // The event moves from Draft to Published: the lists, the counts and the overview change.
    onSuccess: (event) => invalidateEvent(queryClient, event.id),
  });
}
