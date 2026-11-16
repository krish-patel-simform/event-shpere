"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import type { EventGalleryDto } from "../schemas/event-content.schemas";
import { eventMutationKeys, patchEventMedia } from "./event-cache";

/** Adds one or more images to the gallery in one request (the variable is the chosen files). */
export function useAddGalleryImages(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<EventGalleryDto, ApiError, readonly File[]>({
    mutationKey: eventMutationKeys.media(eventId),
    mutationFn: (files) => eventApiService.addGalleryImages(eventId, files),
    // The answer is the whole gallery: it is shown at once, then the content is read again to
    // match what is stored. The overview is not read: the gallery is not part of its flags.
    onSuccess: ({ gallery }) =>
      patchEventMedia(queryClient, eventId, { gallery }),
  });
}
