"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { MyRegistrationDto } from "../schemas/registrations.schemas";
import {
  adjustPublicSeatsLeft,
  invalidateEventRegistration,
  invalidateMyTickets,
  registrationQueryKeys,
} from "./registration-cache";

/**
 * Cancels the signed-in user's registration for one event (route 3). The server cancels their
 * session seats of the event in the same transaction, so the answer has no booked sessions.
 */
export function useCancelRegistration(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<MyRegistrationDto, ApiError, void>({
    mutationFn: () => registrationApiService.cancel(eventId),
    onSuccess: (standing) => {
      queryClient.setQueryData(registrationQueryKeys.mine(eventId), standing);
      // One seat more on the event page, at once (see adjustPublicSeatsLeft for why not a refetch).
      adjustPublicSeatsLeft(queryClient, eventId, 1);
      // The ticket on "My tickets" turns cancelled (read again the next time it is shown).
      return invalidateMyTickets(queryClient);
    },
    onError: (error) => {
      // 404 = the server has no registration to cancel; 409 = the state changed (checked in,
      // registration closed). Either way the page was out of date: read it again.
      if (error.status === 404 || error.status === 409) {
        return invalidateEventRegistration(queryClient, eventId);
      }
    },
  });
}
