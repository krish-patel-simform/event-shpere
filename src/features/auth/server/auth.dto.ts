import "server-only";
import type { OrganizerProfile, RoleName, User } from "../../../db/schemas";
import type {
  AuthUserDto,
  OrganizerSignUpResponseDto,
} from "../schemas/auth.schemas";

type UserRow = { id: string; firstName: string; lastName: string; email: string };

// Picks fields one by one, so passwordHash (or any column added later) can never leak.
export function toAuthUserDto(user: UserRow, role: RoleName): AuthUserDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role,
  };
}

// `user` is the full row (it has passwordHash): picking fields one by one keeps it out.
export function toOrganizerSignUpDto(
  user: User,
  profile: OrganizerProfile,
  verification: { emailSent: boolean; expiresInMinutes: number },
): OrganizerSignUpResponseDto {
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
    verificationEmailSent: verification.emailSent,
    verificationCodeExpiresInMinutes: verification.expiresInMinutes,
  };
}
