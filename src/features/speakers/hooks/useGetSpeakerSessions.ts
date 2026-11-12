"use client";

import { useQuery } from "@tanstack/react-query";
import {
  speakersApiService,
  type ListSpeakerSessionsParams,
} from "../api/speakers-api.service";
import { speakerQueryKeys } from "./useGetSpeakerList";

/**
 * Gets one category (now, upcoming or past) and page of a speaker's sessions, grouped by event.
 * A new category or page is a new query: it is `isPending` until its own rows arrive, so the page
 * shows the skeleton and never the previous rows (no `placeholderData` on purpose).
 */
export function useGetSpeakerSessions(
  slug: string,
  input: ListSpeakerSessionsParams,
) {
  // "No page" and "page 1" are the same request: one key, so the jump links and the section share it.
  const params = { ...input, page: input.page ?? 1 };
  return useQuery({
    queryKey: speakerQueryKeys.sessions(slug, params),
    queryFn: () => speakersApiService.listSessions(slug, params),
  });
}
