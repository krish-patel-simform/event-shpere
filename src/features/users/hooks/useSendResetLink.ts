"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import type { SendResetLinkResponseDto } from "../../auth";
import { usersApiService } from "../api/users-api.service";

/**
 * Sends the user a password reset link (the variable is the user's id). Nothing changes on the
 * user's account until they use the link, so there is nothing to reload.
 */
export function useSendResetLink() {
  return useMutation<SendResetLinkResponseDto, ApiError, string>({
    // Wrapped, so the service gets only the id (React Query would add a second argument).
    mutationFn: (userId) => usersApiService.sendResetLink(userId),
  });
}
