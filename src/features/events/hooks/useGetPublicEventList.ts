"use client";

import { useQuery } from "@tanstack/react-query";
import {
  eventApiService,
  type ListPublicEventsParams,
} from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/**
 * Gets one page of the events anyone can browse. A new search, filter, sort or page is a new
 * query: it is `isPending` until its own rows arrive, so the page shows the skeleton and never the
 * rows of the previous query (no `placeholderData` on purpose).
 */
export function useGetPublicEventList(params: ListPublicEventsParams) {
  return useQuery({
    queryKey: eventQueryKeys.publicList(params),
    queryFn: () => eventApiService.listPublic(params),
  });
}
