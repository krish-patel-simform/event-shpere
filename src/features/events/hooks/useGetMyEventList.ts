"use client";

import { useQuery } from "@tanstack/react-query";
import {
  eventApiService,
  type ListMyEventsParams,
} from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/**
 * Gets one page of the organizer's own events. A new tab, search, sort or page is a new query:
 * it is `isPending` until its own rows arrive, so the page shows the skeleton and never the rows
 * of the previous query (no `placeholderData` on purpose).
 */
export function useGetMyEventList(params: ListMyEventsParams) {
  return useQuery({
    queryKey: eventQueryKeys.list(params),
    queryFn: () => eventApiService.listMine(params),
  });
}
