"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import type { ResendInviteResponseDto } from "../../auth";
import { speakersApiService } from "../api/speakers-api.service";

/**
 * Sends a speaker a new set-password invite (the variable is the speaker's slug). Nothing on the
 * speaker changes until they use the link, so there is nothing to reload.
 */
export function useResendSpeakerInvite() {
  return useMutation<ResendInviteResponseDto, ApiError, string>({
    // Wrapped, so the service gets only the slug (React Query would add a second argument).
    mutationFn: (slug) => speakersApiService.resendInvite(slug),
  });
}
