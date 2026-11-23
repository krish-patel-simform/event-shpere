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

/** Books a seat in one session for the signed-in user (route 8). */
export function useBookSession(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<SessionBookingDto, ApiError, void>({
    mutationFn: () => registrationApiService.bookSession(eventId, sessionId),
    onSuccess: () => {
      // One seat fewer on the session page, and the session counts as booked everywhere that
      // reads the standing (this card, the event page's "N sessions booked").
      adjustPublicSessionSeatsLeft(queryClient, sessionId, -1);
      // "N sessions booked" on "My tickets" too.
      return Promise.all([
        setSessionBooked(queryClient, eventId, sessionId, true),
        invalidateMyTickets(queryClient),
      ]);
    },
    onError: (error) => {
      // A 409 means the page was out of date (already booked in another tab, the last seat went,
      // the event registration was cancelled): read the standing and the seats again.
      if (error.status === 409) {
        return invalidateSessionBooking(queryClient, eventId);
      }
    },
  });
}
