"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { ResetPasswordBody } from "../schemas/auth.schemas";

export function useResetPassword() {
  return useMutation<void, ApiError, ResetPasswordBody>({
    mutationFn: authApiService.resetPassword,
  });
}
