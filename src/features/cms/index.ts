// Client-safe public API of the cms feature. Never export anything from ./server here.
export {
  organizerAccessRequestSchema,
  organizerAccessResponseSchema,
  type OrganizerAccess,
  type OrganizerAccessRequest,
} from "./schemas/strapi-organizer.schemas";
export {
  strapiCreateSpeakerRequestSchema,
  strapiCreateSpeakerResponseSchema,
  type StrapiCreatedSpeaker,
  type StrapiCreateSpeakerRequest,
} from "./schemas/strapi-speaker.schemas";
