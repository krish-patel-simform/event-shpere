import "server-only";
import type { Speaker, User } from "../../../db/schemas";
import type { CreateSpeakerResponseDto } from "../schemas/speaker.schemas";

// Picks fields one by one: passwordHash, cms_speaker_id, createdBy and other internals never leave.
export function toSpeakerDto(
  user: User,
  profile: Speaker,
  setupEmailQueued: boolean,
): CreateSpeakerResponseDto {
  return {
    id: profile.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    slug: profile.slug,
    createdAt: profile.createdAt.toISOString(),
    setupEmailQueued,
  };
}
