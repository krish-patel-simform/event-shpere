"use client";

import { useQuery } from "@tanstack/react-query";
import { stateApiService } from "../api/state-api.service";

/**
 * Gets every state for a dropdown. Reference data that only changes with a seed, so unlike
 * venues it is kept for the whole session (one request, shared by every form that needs it).
 */
export function useGetStateList() {
  return useQuery({
    queryKey: ["states", "list"] as const,
    queryFn: () => stateApiService.list(),
    staleTime: Infinity,
  });
}
