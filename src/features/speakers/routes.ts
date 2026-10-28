/** Page paths of the speakers feature, so a route is renamed in one place (like USER_ROUTES). */
export const SPEAKER_ROUTES = {
  /** The speakers everyone can browse (Discover → Speakers). */
  list: "/speakers",
} as const;

/** The page of one speaker. `slug` = speaker_profiles.slug (it is also the API id). */
export function speakerHref(slug: string): string {
  return `${SPEAKER_ROUTES.list}/${slug}`;
}

/** The page where a speaker edits their own public profile ("Edit my profile"). */
export const SPEAKER_PROFILE_ROUTE = "/speaker/profile";
