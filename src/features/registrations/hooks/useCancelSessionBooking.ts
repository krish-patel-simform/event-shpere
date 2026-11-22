"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { SessionBookingDto } from "../schemas/registrations.schemas";
import {
  adjustPublicSessionSeatsLeft,
  invalidateMyTickets,
  invalidateSessionBooking,
  setSessionBooked,
} from "./registration-cache";

/**
 * Cancels the signed-in user's seat in one session (route 9). They stay registered for the
 * event; only this seat is released.
 */
export function useCancelSessionBooking(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionBookingDto, ApiError, void>({
    mutationFn: () =>
      registrationApiService.cancelSessionBooking(eventId, sessionId),
    onSuccess: () => {
      adjustPublicSessionSeatsLeft(queryClient, sessionId, 1);
      return Promise.all([
        setSessionBooked(queryClient, eventId, sessionId, false),
        invalidateMyTickets(queryClient),
      ]);
    },
    onError: (error) => {
      // 404 = no seat to cancel; 409 = the state changed (checked in, cancelling closed).
      if (error.status === 404 || error.status === 409) {
        return invalidateSessionBooking(queryClient, eventId);
      }
    },
  });
}
