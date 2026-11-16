"use client";

import { useQuery } from "@tanstack/react-query";
import { eventApiService } from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/** Gets how many events each tab holds, for the numbers on the tabs. */
export function useGetMyEventCounts() {
  return useQuery({
    queryKey: eventQueryKeys.counts,
    queryFn: () => eventApiService.countMine(),
  });
}
