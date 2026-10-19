"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { AuthUserDto, LoginBody } from "../schemas/auth.schemas";

export function useLogin() {
  return useMutation<AuthUserDto, ApiError, LoginBody>({
    mutationFn: authApiService.login,
  });
}
