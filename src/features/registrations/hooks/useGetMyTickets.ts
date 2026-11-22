"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import {
  registrationApiService,
  type ListMyTicketsParams,
} from "../api/registration-api.service";
import { registrationQueryKeys } from "./registration-cache";

/**
 * One page of the signed-in user's tickets (route 4). A new tab, status or page is a new query:
 * it is `isPending` until its own rows arrive, so the page shows the skeleton and never the rows
 * of the previous query (no `placeholderData` on purpose).
 */
export function useGetMyTickets(params: ListMyTicketsParams) {
  return useQuery<
    Awaited<ReturnType<typeof registrationApiService.listMyTickets>>,
    ApiError
  >({
    queryKey: registrationQueryKeys.ticketList(params),
    queryFn: () => registrationApiService.listMyTickets(params),
  });
}
