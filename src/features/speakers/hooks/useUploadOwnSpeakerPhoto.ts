"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { speakersApiService } from "../api/speakers-api.service";
import type {
  OwnSpeakerProfileDto,
  SpeakerPhotoResponseDto,
} from "../schemas/speaker.schemas";
import { speakerQueryKeys } from "./useGetSpeakerList";

/** Replaces the speaker's photo (the variable is the chosen image file). */
export function useUploadOwnSpeakerPhoto() {
  const queryClient = useQueryClient();
  return useMutation<SpeakerPhotoResponseDto, ApiError, File>({
    mutationFn: (file) => speakersApiService.uploadOwnPhoto(file),
    onSuccess: ({ photo }) => {
      // Only the photo changed: keep the rest of the cached profile as it is.
      const own = queryClient.getQueryData<OwnSpeakerProfileDto>(
        speakerQueryKeys.own,
      );
      if (own) {
        queryClient.setQueryData<OwnSpeakerProfileDto>(speakerQueryKeys.own, {
          ...own,
          photo,
        });
        void queryClient.invalidateQueries({
          queryKey: speakerQueryKeys.detail(own.slug),
        });
      }
      void queryClient.invalidateQueries({ queryKey: speakerQueryKeys.lists });
    },
  });
}
