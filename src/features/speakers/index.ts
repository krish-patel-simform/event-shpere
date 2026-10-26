// Client-safe public API of the speakers feature. Never export anything from ./server here.
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
  SPEAKER_PHOTO_FORM_FIELD,
  SPEAKER_PHOTO_MAX_BYTES,
  SPEAKER_PHOTO_TYPES,
  type SpeakerPhotoType,
} from "./constants";
export { blocksToText, textToBlocks } from "./utils/bio-blocks";
