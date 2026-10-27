"use client";

import { useQuery } from "@tanstack/react-query";
import {
  organizerApiService,
  type ListOrganizersParams,
} from "../api/organizer-api.service";

/** One place for the keys: every decision invalidates `all`, which refreshes every list. */
export const organizerQueryKeys = {
  all: ["organizers"] as const,
  list: (params: ListOrganizersParams) =>
    ["organizers", "list", params] as const,
  detail: (organizerId: string) =>
    ["organizers", "detail", organizerId] as const,
};

/**
 * Gets one list of organizers (all / waiting / approved / rejected). A new tab, search, filter or
 * page is a new query: it is `isPending` until its own rows arrive, so the page shows the
 * skeleton and never the rows of the previous query (no `placeholderData` on purpose).
 */
export function useGetOrganizerList(params: ListOrganizersParams) {
  return useQuery({
    queryKey: organizerQueryKeys.list(params),
    queryFn: () => organizerApiService.list(params),
  });
}
