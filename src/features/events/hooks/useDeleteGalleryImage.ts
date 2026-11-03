"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventGalleryDto } from "../schemas/event-content.schemas";
import { eventMutationKeys, invalidateEventContent } from "./event-cache";

/** Removes one gallery image (the variable is its Strapi file id). */
export function useDeleteGalleryImage(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventGalleryDto, ApiError, number>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: (fileId) => eventApiService.deleteGalleryImage(eventId, fileId),
    onSuccess: () => invalidateEventContent(queryClient, eventId),
  });
}
