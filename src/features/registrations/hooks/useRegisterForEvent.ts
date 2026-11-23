"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { RegistrationDto } from "../schemas/registrations.schemas";
import {
  adjustPublicSeatsLeft,
  invalidateEventRegistration,
  invalidateMyTickets,
  registrationQueryKeys,
} from "./registration-cache";

/** Registers the signed-in user for one event (route 1). */
export function useRegisterForEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation<RegistrationDto, ApiError, void>({
    mutationFn: () => registrationApiService.register(eventId),
    onSuccess: (registration) => {
      // The answer IS the new standing: a fresh registration has no seats, and a revived one lost
      // its seats when it was cancelled. So the card shows it at once, without a second request.
      queryClient.setQueryData(registrationQueryKeys.mine(eventId), {
        registration,
        bookedSessionIds: [],
      });
      // One seat fewer on the event page, at once (see adjustPublicSeatsLeft for why not a refetch).
      adjustPublicSeatsLeft(queryClient, eventId, -1);
      // The ticket shows on "My tickets" (read again the next time it is shown).
      return invalidateMyTickets(queryClient);
    },
    onError: (error) => {
      // A 409 means the page was out of date (already registered in another tab, the last seat
      // went, the window closed): read the standing and the seats again.
      if (error.status === 409) {
        return invalidateEventRegistration(queryClient, eventId);
      }
    },
  });
}
