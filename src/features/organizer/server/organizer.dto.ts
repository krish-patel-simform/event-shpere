import "server-only";
import type { OrganizerProfile, User } from "../../../db/schemas";
import type { OrganizerDto } from "../schemas/organizer.schemas";

// Picks fields one by one: passwordHash, verifiedBy and other internals never leave.
export function toOrganizerDto(
  user: User,
  profile: OrganizerProfile,
  setupEmailQueued: boolean,
): OrganizerDto {
  return {
    id: profile.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    organizationName: profile.organizationName,
    organizationWebsite: profile.organizationWebsite,
    isVerified: profile.verifiedAt !== null,
    createdAt: profile.createdAt.toISOString(),
    setupEmailQueued,
  };
}
