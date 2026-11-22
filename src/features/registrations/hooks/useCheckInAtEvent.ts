"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type {
  CheckInDto,
  EventCheckInBody,
} from "../schemas/check-ins.schemas";
import {
  toCheckInFailure,
  type CheckInContext,
  type CheckInOutcome,
} from "../utils/check-in-result";
import { invalidateAttendees } from "./registration-cache";

/**
 * The event door's `send` (route 6): checks one code in for the day in its context and answers
 * a CheckInOutcome, never throws, so the door's line can show every answer on its row.
 *
 * After a check-in (or a 409, which means the screen was out of date) the attendee counts and
 * lists are refreshed in the BACKGROUND: the refresh is not awaited, so the next code in the line
 * goes out at once instead of waiting for the list to reload.
 */
export function useCheckInAtEvent(eventId: string) {
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation<CheckInDto, ApiError, EventCheckInBody>({
    mutationFn: (body) => registrationApiService.checkInAtEvent(eventId, body),
    onSuccess: () => {
      void invalidateAttendees(queryClient, eventId);
    },
    onError: (error) => {
      if (error.status === 409) void invalidateAttendees(queryClient, eventId);
    },
  });

  return useCallback(
    async (code: string, context: CheckInContext): Promise<CheckInOutcome> => {
      if (context.door !== "event") {
        throw new Error("The event door needs an event day");
      }
      try {
        const checkIn = await mutateAsync({
          ticketCode: code,
          attendanceDate: context.date,
        });
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
