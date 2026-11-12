// Client-safe public API of the speakers feature. Never export anything from ./server here.
export { SpeakerDetail } from "./components/SpeakerDetail";
export { SpeakerDetailSkeleton } from "./components/SpeakerDetailSkeleton";
export { SpeakerDirectory } from "./components/SpeakerDirectory";
export { SPEAKER_ROUTES, speakerHref } from "./routes";
export {
  createSpeakerBodySchema,
  createSpeakerResponseSchema,
  existingSpeakerSchema,
  getSpeakersResponseSchema,
  listSpeakersQuerySchema,
  ownSpeakerProfileResponseSchema,
  speakerExistsDetailsSchema,
  speakerListItemSchema,
  speakerPhotoResponseSchema,
  speakerProfileResponseSchema,
  speakerSlugParamsSchema,
  updateOwnSpeakerProfileBodySchema,
  type CreateSpeakerBody,
  type CreateSpeakerResponseDto,
  type ExistingSpeakerDto,
  type ListSpeakersQuery,
  type OwnSpeakerProfileDto,
  type SpeakerExistsDetails,
  type SpeakerListItemDto,
  type SpeakerPhotoResponseDto,
  type SpeakerProfileDto,
  type SpeakerSlugParams,
  type UpdateOwnSpeakerProfileBody,
  type UpdateOwnSpeakerProfileInput,
} from "./schemas/speaker.schemas";
export {
  listSpeakerSessionsQuerySchema,
  speakerSessionParams,
  speakerSessionsMetaSchema,
  speakerSessionsResponseSchema,
  speakerSessionTimelines,
  type ListSpeakerSessionsQuery,
  type SpeakerSessionDto,
  type SpeakerSessionGroupDto,
  type SpeakerSessionsMeta,
  type SpeakerSessionTimeline,
} from "./schemas/speaker-sessions.schemas";
export {
  SPEAKER_PHOTO_FORM_FIELD,
  SPEAKER_PHOTO_MAX_BYTES,
  SPEAKER_PHOTO_TYPES,
  type SpeakerPhotoType,
} from "./constants";
export { blocksToText, textToBlocks } from "./utils/bio-blocks";
// For pickers in other features (an organizer chooses a session's speakers from the list).
export { useGetSpeakerList } from "./hooks/useGetSpeakerList";
export { speakerFullName } from "./utils/speaker-display";
// "Edit my profile": the page content loads and saves the real profile; the form alone still
// works on sample data (no props).
export { OwnSpeakerProfile } from "./components/OwnSpeakerProfile";
export { SpeakerProfileForm } from "./components/SpeakerProfileForm";
export {
  SpeakerProfileError,
  SpeakerProfileSkeleton,
} from "./components/SpeakerProfileStates";
export { SPEAKER_PROFILE_ROUTE } from "./routes";
export { OWN_SPEAKER_PROFILE_SAMPLE } from "./utils/own-profile.sample";
