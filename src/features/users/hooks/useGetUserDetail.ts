"use client";

import { useQuery } from "@tanstack/react-query";
import { usersApiService } from "../api/users-api.service";
import { userQueryKeys } from "./useGetUserList";

/**
 * Gets one user for the profile page. Suspending or reactivating invalidates every user query,
 * so this reloads by itself and the page shows the new status.
 */
export function useGetUserDetail(userId: string) {
  return useQuery({
    queryKey: userQueryKeys.detail(userId),
    queryFn: () => usersApiService.get(userId),
  });
}
