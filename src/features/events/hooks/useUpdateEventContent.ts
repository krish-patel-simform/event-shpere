"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type {
  EventContentDto,
  UpdateEventContentBody,
} from "../schemas/event-content.schemas";
import { applyEventContent } from "./event-cache";

/** Saves the event page's text (the variable is the body of PATCH .../content). */
export function useUpdateEventContent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventContentDto, ApiError, UpdateEventContentBody>({
    mutationFn: (body) => eventApiService.updateContent(eventId, body),
    // The answer is the whole content as saved: it is shown at once, then the content is read
    // again to match what is stored. The overview is not read: its description flag follows from
    // the content.
    onSuccess: (content) => applyEventContent(queryClient, eventId, content),
  });
}
