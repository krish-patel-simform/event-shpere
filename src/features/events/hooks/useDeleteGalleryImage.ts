"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventGalleryDto } from "../schemas/event-content.schemas";
import { eventMutationKeys, patchEventMedia } from "./event-cache";

/** Removes one gallery image (the variable is its Strapi file id). */
export function useDeleteGalleryImage(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventGalleryDto, ApiError, number>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: (fileId) => eventApiService.deleteGalleryImage(eventId, fileId),
    // The answer is the images that are left: they are shown at once, then the content is read
    // again to match what is stored. The overview is not read: the gallery is not part of its
    // flags.
    onSuccess: ({ gallery }) =>
      patchEventMedia(queryClient, eventId, { gallery }),
  });
}
