import "server-only";
import type { OrganizerProfile, User } from "../../../db/schemas";
import type {
  CreateOrganizerResponseDto,
  OrganizerListItemDto,
} from "../schemas/organizer.schemas";

// Picks fields one by one: passwordHash, the verifier's user id and other internals never leave.
export function toOrganizerDto(
  user: User,
  profile: OrganizerProfile,
  setupEmailQueued: boolean,
): CreateOrganizerResponseDto {
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

type OrganizerListRow = {
  id: string;
  organizerFirstName: string;
  organizerLastName: string;
  organizationName: string;
  organizationWebsite: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
};

export function toOrganizerListItemDto(
  row: OrganizerListRow,
): OrganizerListItemDto {
  return {
    id: row.id,
    organizerFirstName: row.organizerFirstName,
    organizerLastName: row.organizerLastName,
    organizationName: row.organizationName,
    organizationWebsite: row.organizationWebsite,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifiedBy: row.verifiedBy,
  };
}
