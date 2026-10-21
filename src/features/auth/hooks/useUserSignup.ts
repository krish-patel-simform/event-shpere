"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type {
  UserSignUpResponseDto,
  UserSignupBody,
} from "../schemas/auth.schemas";

export function useUserSignup() {
  return useMutation<UserSignUpResponseDto, ApiError, UserSignupBody>({
    mutationFn: authApiService.signUpUser,
  });
}
