"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { registrationApiService } from "../api/registration-api.service";
import type { SessionAttendeeListMeta } from "../schemas/attendees.schemas";
import { registrationQueryKeys } from "./registration-cache";

/** The seat counts, and how early the session's door opens (both from route 10's meta). */
export type SessionAttendeeSummary = Pick<
  SessionAttendeeListMeta,
  "counts" | "checkInOpensHoursBefore"
>;

/**
 * A session's seat counts (booked, cancelled, checked in, pending), for the whole session, plus
 * how early its door opens. They do not depend on the search, the filters, the sort or the page,
 * so they are read on their own (a one-row page of route 10): a filter change asks only for new
 * rows and the cards keep their numbers.
 */
export function useGetSessionAttendeeCounts(
  eventId: string,
  sessionId: string,
) {
  return useQuery<SessionAttendeeSummary, ApiError>({
    queryKey: registrationQueryKeys.sessionAttendeeCounts(eventId, sessionId),
    queryFn: async () => {
      const { meta } = await registrationApiService.listSessionAttendees(
        eventId,
        sessionId,
        {
          page: 1,
          pageSize: 1,
          status: "all",
          checkedIn: "all",
          sort: "newest",
        },
      );
      return {
        counts: meta.counts,
        checkInOpensHoursBefore: meta.checkInOpensHoursBefore,
      };
    },
  });
}
