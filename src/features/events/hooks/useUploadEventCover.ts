"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventCoverDto } from "../schemas/event-content.schemas";
import { invalidateEventContent } from "./event-cache";

/** Sets or replaces the cover image (the variable is the chosen file). */
export function useUploadEventCover(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventCoverDto, ApiError, File>({
    mutationFn: (file) => eventApiService.uploadCover(eventId, file),
    // The media step shows the new cover; the checklist reads "banner added" from the overview.
    onSuccess: () => invalidateEventContent(queryClient, eventId),
  });
}
