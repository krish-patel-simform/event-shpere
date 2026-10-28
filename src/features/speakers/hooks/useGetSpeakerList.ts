"use client";

import { useQuery } from "@tanstack/react-query";
import {
  speakersApiService,
  type ListSpeakersParams,
} from "../api/speakers-api.service";

/** One place for the keys: inviting a speaker invalidates `all`, which refreshes the list. */
export const speakerQueryKeys = {
  all: ["speakers"] as const,
  /** Every list page, whatever its search or page number. */
  lists: ["speakers", "list"] as const,
  list: (params: ListSpeakersParams) => ["speakers", "list", params] as const,
  detail: (slug: string) => ["speakers", "detail", slug] as const,
  /** The logged-in speaker's own profile (the edit form). */
  own: ["speakers", "own"] as const,
};

/**
 * Gets one page of speakers. A new search or page is a new query: it is `isPending` until its own
 * rows arrive, so the page shows the skeleton and never the previous rows (no `placeholderData`
 * on purpose).
 */
export function useGetSpeakerList(params: ListSpeakersParams) {
  return useQuery({
    queryKey: speakerQueryKeys.list(params),
    queryFn: () => speakersApiService.list(params),
  });
}
