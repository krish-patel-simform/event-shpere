"use client";

import { useQuery } from "@tanstack/react-query";
import { eventApiService } from "../api/event-api.service";
import { eventQueryKeys } from "./event-cache";

/** Gets one event's public page by its link (an unknown or draft event is a 404 error). */
export function useGetPublicEvent(slug: string) {
  return useQuery({
    queryKey: eventQueryKeys.publicDetail(slug),
    queryFn: () => eventApiService.getPublic(slug),
  });
}
