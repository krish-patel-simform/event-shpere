import "server-only";
import type {
  OrganizerProfile,
  RoleName,
  User,
  UserProfile,
} from "../../../db/schemas";
import type {
  AuthUserDto,
  OrganizerSignUpResponseDto,
  UserSignUpResponseDto,
} from "../schemas/auth.schemas";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

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

// The return type makes TypeScript check this against userSignupResponseSchema.
export function toUserSignUpDto(
  user: User,
  profile: UserProfile,
  verification: { emailSent: boolean; expiresInMinutes: number },
): UserSignUpResponseDto {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    phone: profile.phone,
    city: profile.city,
    postalCode: profile.postalCode,
    avatarUrl: profile.avatarUrl,
    isVerified: user.emailVerifiedAt !== null,
    verificationEmailSent: verification.emailSent,
    verificationCodeExpiresInMinutes: verification.expiresInMinutes,
  };
}
