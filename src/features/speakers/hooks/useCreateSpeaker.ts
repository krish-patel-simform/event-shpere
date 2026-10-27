"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { speakersApiService } from "../api/speakers-api.service";
import type {
  CreateSpeakerBody,
  CreateSpeakerResponseDto,
} from "../schemas/speaker.schemas";
import { speakerQueryKeys } from "./useGetSpeakerList";

/** Invites a speaker (the variable is the form's body). */
export function useCreateSpeaker() {
  const queryClient = useQueryClient();
  return useMutation<CreateSpeakerResponseDto, ApiError, CreateSpeakerBody>({
    // Wrapped, so the service gets only the body (React Query would add a second argument).
    mutationFn: (body) => speakersApiService.create(body),
    // The new speaker shows up in the list.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: speakerQueryKeys.all }),
  });
}
