"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type {
  EventContentDto,
  UpdateEventContentBody,
} from "../schemas/event-content.schemas";
import { eventQueryKeys, invalidateEventContent } from "./event-cache";

/** Saves the event page's text (the variable is the body of PATCH .../content). */
export function useUpdateEventContent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventContentDto, ApiError, UpdateEventContentBody>({
    mutationFn: (body) => eventApiService.updateContent(eventId, body),
    onSuccess: (content) => {
      // The answer is the whole content as saved: put it in the cache so the step shows it at once.
      queryClient.setQueryData(eventQueryKeys.content(eventId), content);
      // The publish checklist reads "description written" from the overview.
      return invalidateEventContent(queryClient, eventId);
    },
  });
}
