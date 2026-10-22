"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { AuthUserDto, LoginBody } from "../schemas/auth.schemas";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthUserDto, ApiError, LoginBody>({
    mutationFn: authApiService.login,
    // A new session starts: forget anything cached for a previous one (e.g. an old `me`, or the
    // 401 a visitor got before logging in).
    onSuccess: () => queryClient.clear(),
  });
}
