"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../../core/api-client/base-api.service";
import { venueApiService } from "../api/venue-api.service";
import type { HallAvailabilityRequest } from "../schemas/hall-availability.schemas";
import { ALWAYS_FRESH, venueQueryKeys } from "./venue-cache";

/**
 * Gets which halls of a venue are free for a time range. Nothing is requested until there is a
 * venue AND a range (`range` is null while the dates are not filled in or not valid).
 *
 * Bookings change whenever anyone saves a session, so a cached answer would show a hall as free
 * that is no longer: it is never reused (ALWAYS_FRESH). A new range is a new query, `isPending`
 * until its own answer arrives, so the screen shows the loading state and never the halls of the
 * previous range (no `placeholderData` on purpose).
 *
 * A 4xx is a final answer (not approved, venue gone or inactive): asking again would not change
 * it, so only a failure that may pass is retried.
 */
export function useGetHallAvailability(
  venueId: string,
  range: HallAvailabilityRequest | null,
) {
  return useQuery({
    queryKey: venueQueryKeys.hallAvailability(
      venueId,
      range ?? { startAt: "", endAt: "" },
    ),
    queryFn: () => {
      if (!range) throw new Error("No range to ask about");
      return venueApiService.getHallAvailability(venueId, range);
    },
    enabled: venueId !== "" && range !== null,
    retry: (failureCount, error) =>
      !(
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) && failureCount < 2,
    ...ALWAYS_FRESH,
  });
}
