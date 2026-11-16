"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { CreateEventRequest, EventDto } from "../schemas/events.schemas";
import { invalidateEvent } from "./event-cache";

/** Creates a draft event (the variable is the form's request body). */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation<EventDto, ApiError, CreateEventRequest>({
    // Wrapped, so the service gets only the body (React Query would add a second argument).
    mutationFn: (body) => eventApiService.create(body),
    // The new event shows up in the list and in the tab counts.
    onSuccess: (event) => invalidateEvent(queryClient, event.id),
  });
}
