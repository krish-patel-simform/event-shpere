"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { usersApiService } from "../api/users-api.service";
import type { UserStatusDto } from "../schemas/users.schema";
import { userQueryKeys } from "./useGetUserList";

/** Reactivates a suspended user (the variable is the user's id), then refreshes the list. */
export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserStatusDto, ApiError, string>({
    // Wrapped, so the service gets only the id (React Query would add a second argument).
    mutationFn: (userId) => usersApiService.reactivate(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all }),
  });
}
