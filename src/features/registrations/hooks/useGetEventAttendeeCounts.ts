"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { AttendeeListMeta } from "../schemas/attendees.schemas";
import { registrationQueryKeys } from "./registration-cache";

/** The counts, and the door setting the check-in panel needs (both from route 5's meta). */
export type EventAttendeeSummary = Pick<
  AttendeeListMeta,
  "counts" | "checkInOpensHoursBefore"
>;

/**
 * The Attendees tab's counts (registered, cancelled, checked in, pending) for the whole event,
 * on one day or on any day, plus how early each day's door opens. Route 5 sends them with every
 * page, but they do not depend on the search, the filters, the sort or the page, so they are
 * read on their own: a filter change asks only for new rows, and the count cards stay as they
 * are. A one-row page is asked for, because only the meta is used.
 */
export function useGetEventAttendeeCounts(
  eventId: string,
  date: string | undefined,
) {
  return useQuery<EventAttendeeSummary, ApiError>({
    queryKey: registrationQueryKeys.attendeeCounts(eventId, date),
    queryFn: async () => {
      const { meta } = await registrationApiService.listEventAttendees(
        eventId,
        {
          page: 1,
          pageSize: 1,
          status: "all",
          checkedIn: "all",
          sort: "newest",
          date,
        },
      );
      return {
        counts: meta.counts,
        checkInOpensHoursBefore: meta.checkInOpensHoursBefore,
      };
    },
  });
}
