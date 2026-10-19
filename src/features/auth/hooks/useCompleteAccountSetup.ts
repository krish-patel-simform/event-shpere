"use client";

import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { AccountSetupBody } from "../schemas/auth.schemas";

export function useCompleteAccountSetup() {
  return useMutation<void, ApiError, AccountSetupBody>({
    mutationFn: authApiService.completeAccountSetup,
  });
}
