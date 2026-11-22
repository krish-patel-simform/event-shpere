"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { MyRegistrationDto } from "../schemas/registrations.schemas";
import { registrationQueryKeys } from "./registration-cache";

/**
 * The signed-in user's standing in one event (route 2). Pass `enabled: false` for a guest or an
 * organizer/admin account: the route answers them 401/403, so it is not asked at all.
 */
export function useGetMyRegistration(
  eventId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery<MyRegistrationDto, ApiError>({
    queryKey: registrationQueryKeys.mine(eventId),
    queryFn: () => registrationApiService.getMine(eventId),
    enabled,
  });
}
