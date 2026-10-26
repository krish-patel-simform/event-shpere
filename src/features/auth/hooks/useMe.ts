"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { authApiService } from "../api/auth-api.service";
import type { MeDto } from "../schemas/auth.schemas";

/** One place for the key, so login/logout can later refresh or clear the signed-in user. */
export const authQueryKeys = { me: ["auth", "me"] } as const;

/**
 * The signed-in user (GET /api/auth/me). A 401 error means nobody is signed in.
 * Pass `enabled: false` once the session is known to be over (just logged out), so the query is
 * not fetched again by a component that is still on screen.
 * Pass `refetchOnMount: false` from a component that only reads the user someone else loaded
 * (PermissionProvider): it reuses the cached user instead of fetching it again when it mounts,
 * and still fetches when nothing is cached yet.
 */
export function useMe({
  enabled = true,
  refetchOnMount = true,
}: { enabled?: boolean; refetchOnMount?: boolean } = {}) {
  return useQuery<MeDto, ApiError>({
    queryKey: authQueryKeys.me,
    queryFn: authApiService.getMe,
    enabled,
    refetchOnMount,
  });
}
