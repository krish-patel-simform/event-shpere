"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventCoverDto } from "../schemas/event-content.schemas";
import { eventMutationKeys, patchEventMedia } from "./event-cache";

/** Sets or replaces the cover image (the variable is the chosen file). */
export function useUploadEventCover(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventCoverDto, ApiError, File>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: (file) => eventApiService.uploadCover(eventId, file),
    // The answer is the new cover: it is shown at once, then the content is read again to match
    // what is stored. The overview is not read: its banner flag follows from the content.
    onSuccess: ({ coverImage }) =>
      patchEventMedia(queryClient, eventId, { coverImage }),
  });
}
