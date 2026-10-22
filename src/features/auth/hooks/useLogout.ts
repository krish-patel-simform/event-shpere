"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: authApiService.logout,
    // Drop everything cached for this user (the `me` data and any later account data), so the
    // next person to log in on this browser never sees it.
    onSuccess: () => queryClient.clear(),
  });
}
