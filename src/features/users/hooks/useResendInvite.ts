"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import type { ResendInviteResponseDto } from "../../auth";
import { usersApiService } from "../api/users-api.service";

/**
 * Sends a pending account a new set-password invite (the variable is the user's id), whatever
 * their role. Nothing on the account changes until they use the link, so there is nothing to
 * reload.
 */
export function useResendInvite() {
  return useMutation<ResendInviteResponseDto, ApiError, string>({
    // Wrapped, so the service gets only the id (React Query would add a second argument).
    mutationFn: (userId) => usersApiService.resendInvite(userId),
  });
}
