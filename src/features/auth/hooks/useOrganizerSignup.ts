"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type {
  OrganizerSignUpResponseDto,
  OrganizerSignupBody,
} from "../schemas/auth.schemas";

export function useOrganizerSignup() {
  return useMutation<OrganizerSignUpResponseDto, ApiError, OrganizerSignupBody>(
    { mutationFn: authApiService.signUpOrganizer },
  );
}
