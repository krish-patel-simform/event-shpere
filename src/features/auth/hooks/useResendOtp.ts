"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { ResendOtpBody } from "../schemas/auth.schemas";

export function useResendOtp() {
  return useMutation<void, ApiError, ResendOtpBody>({
    mutationFn: authApiService.resendOtp,
  });
}
