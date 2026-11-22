"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type {
  CheckInBody,
  SessionCheckInDto,
} from "../schemas/check-ins.schemas";
import {
  toCheckInFailure,
  type CheckInOutcome,
} from "../utils/check-in-result";
import { invalidateAttendees } from "./registration-cache";

/**
 * The session door's `send` (route 11): checks one code in at this session and answers a
 * CheckInOutcome, never throws. Only the code is sent (the server takes the day from the
 * session). The session's seat list and counts (and the event's, under the same key) are
 * refreshed in the background after a check-in or a 409, without holding up the next code.
 */
export function useCheckInAtSession(eventId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation<SessionCheckInDto, ApiError, CheckInBody>(
    {
      mutationFn: (body) =>
        registrationApiService.checkInAtSession(eventId, sessionId, body),
      onSuccess: () => {
        void invalidateAttendees(queryClient, eventId);
      },
      onError: (error) => {
        if (error.status === 409) {
          void invalidateAttendees(queryClient, eventId);
        }
      },
    },
  );

  return useCallback(
    async (code: string): Promise<CheckInOutcome> => {
      try {
        const checkIn = await mutateAsync({ ticketCode: code });
        return {
          ok: true,
          attendee: checkIn.attendee,
          checkedInAt: checkIn.checkedInAt,
        };
      } catch (error) {
        return toCheckInFailure(error);
      }
    },
    [mutateAsync],
  );
}
