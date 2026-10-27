"use client";

import { useQuery } from "@tanstack/react-query";
import {
  usersApiService,
  type ListUsersParams,
} from "../api/users-api.service";

/** One place for the keys: suspending or reactivating invalidates `all`, which refreshes the list. */
export const userQueryKeys = {
  all: ["users"] as const,
  list: (params: ListUsersParams) => ["users", "list", params] as const,
  detail: (userId: string) => ["users", "detail", userId] as const,
};

/**
 * Gets one page of users for the admin. A new tab, filter, search or page is a new query: it
 * is `isPending` until its own rows arrive, so the page shows the skeleton and never the rows of
 * the previous query (no `placeholderData` on purpose).
 */
export function useGetUserList(params: ListUsersParams) {
  return useQuery({
    queryKey: userQueryKeys.list(params),
    queryFn: () => usersApiService.list(params),
  });
}
