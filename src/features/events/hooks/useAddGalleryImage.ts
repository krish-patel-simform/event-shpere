"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventGalleryDto } from "../schemas/event-content.schemas";
import { eventMutationKeys, invalidateEventContent } from "./event-cache";

/** Adds one image to the gallery (the variable is the chosen file). */
export function useAddGalleryImage(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventGalleryDto, ApiError, File>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: (file) => eventApiService.addGalleryImage(eventId, file),
    onSuccess: () => invalidateEventContent(queryClient, eventId),
  });
}
