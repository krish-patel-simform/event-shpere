// Client-safe public API of the speakers feature. Never export anything from ./server here.
export {
  createSpeakerBodySchema,
  createSpeakerResponseSchema,
  type CreateSpeakerBody,
  type CreateSpeakerResponseDto,
} from "./schemas/speaker.schemas";
