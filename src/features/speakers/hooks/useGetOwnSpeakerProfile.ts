"use client";

import { useQuery } from "@tanstack/react-query";
import { speakersApiService } from "../api/speakers-api.service";
import { speakerQueryKeys } from "./useGetSpeakerList";

/** Gets the logged-in speaker's own profile, as the values of the "Edit my profile" form. */
export function useGetOwnSpeakerProfile() {
  return useQuery({
    queryKey: speakerQueryKeys.own,
    queryFn: () => speakersApiService.getOwnProfile(),
    // The form copies these values once when it opens, so coming back to the page must load them
    // again (skeleton) instead of editing a cached copy.
    gcTime: 0,
  });
}
