"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { speakersApiService } from "../api/speakers-api.service";
import type {
  OwnSpeakerProfileDto,
  UpdateOwnSpeakerProfileBody,
} from "../schemas/speaker.schemas";
import { speakerQueryKeys } from "./useGetSpeakerList";

/** Saves the speaker's own profile fields (the variable is the form's parsed body). */
export function useUpdateOwnSpeakerProfile() {
  const queryClient = useQueryClient();
  return useMutation<
    OwnSpeakerProfileDto,
    ApiError,
    UpdateOwnSpeakerProfileBody
  >({
    mutationFn: (body) => speakersApiService.updateOwnProfile(body),
    onSuccess: (profile) => {
      // The answer is the whole saved profile: the form reads it without another request.
      queryClient.setQueryData(speakerQueryKeys.own, profile);
      // The public page and the directory show the new details.
      void queryClient.invalidateQueries({
        queryKey: speakerQueryKeys.detail(profile.slug),
      });
      void queryClient.invalidateQueries({ queryKey: speakerQueryKeys.lists });
    },
  });
}
