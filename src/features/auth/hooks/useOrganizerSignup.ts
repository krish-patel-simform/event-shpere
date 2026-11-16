"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type {
  OrganizerSignupBody,
  SignUpResponseDto,
} from "../schemas/auth.schemas";

export function useOrganizerSignup() {
  return useMutation<SignUpResponseDto, ApiError, OrganizerSignupBody>({
    mutationFn: authApiService.signUpOrganizer,
  });
}
