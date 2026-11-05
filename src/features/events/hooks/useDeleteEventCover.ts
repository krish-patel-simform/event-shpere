"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import { eventMutationKeys, patchEventMedia } from "./event-cache";

/** Removes the cover image. */
export function useDeleteEventCover(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: () => eventApiService.deleteCover(eventId),
    // The answer is empty (204) and the result is known: no cover. It is shown at once, then the
    // content is read again to match what is stored. The overview is not read: its banner flag
    // follows from the content.
    onSuccess: () =>
      patchEventMedia(queryClient, eventId, { coverImage: null }),
  });
}
