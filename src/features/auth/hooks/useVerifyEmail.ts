"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { VerifyEmailBody } from "../schemas/auth.schemas";

export function useVerifyEmail() {
  return useMutation<void, ApiError, VerifyEmailBody>({
    mutationFn: authApiService.verifyEmail,
  });
}
