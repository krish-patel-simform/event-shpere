"use client";

import { useQuery } from "@tanstack/react-query";
import { speakersApiService } from "../api/speakers-api.service";
import { speakerQueryKeys } from "./useGetSpeakerList";

/** Gets one speaker (the name and the CMS profile) for the detail page. */
export function useGetSpeakerDetail(slug: string) {
  return useQuery({
    queryKey: speakerQueryKeys.detail(slug),
    queryFn: () => speakersApiService.get(slug),
  });
}
