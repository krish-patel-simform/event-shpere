"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { ForgotPasswordBody } from "../schemas/auth.schemas";

export function useForgotPassword() {
  return useMutation<void, ApiError, ForgotPasswordBody>({
    mutationFn: authApiService.forgotPassword,
  });
}
