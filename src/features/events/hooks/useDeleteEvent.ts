"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { eventApiService } from "../api/event-api.service";
import { eventQueryKeys, SESSIONS_QUERY_ROOT } from "./event-cache";

/** Deletes a draft event (the variable is the event's id; a list can delete any draft row). */
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (eventId) => eventApiService.remove(eventId),
    onSuccess: (_, eventId) =>
      Promise.all([
        // The row is gone: the lists and the tab counts are read again.
        queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: eventQueryKeys.counts }),
        // The deleted event's own pages (overview, content, its sessions) are marked old but NOT
        // read again: the event is gone, so a page still open on it would only get a 404.
        queryClient.invalidateQueries({
          queryKey: eventQueryKeys.overview(eventId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: eventQueryKeys.content(eventId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: SESSIONS_QUERY_ROOT,
          refetchType: "none",
        }),
      ]),
  });
}
