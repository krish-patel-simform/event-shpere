import "server-only";
import type { RoleName } from "../../../db/schemas";
import type { AuthUserDto, SignUpResponseDto } from "../schemas/auth.schemas";

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

// The one answer of both signups. It takes only the email (never a database row) and it is the
// same for a new email and for one that already has an account.
export function toSignUpDto(
  email: string,
  verification: { emailSent: boolean; expiresInMinutes: number },
): SignUpResponseDto {
  return {
    email,
    verificationEmailSent: verification.emailSent,
    verificationCodeExpiresInMinutes: verification.expiresInMinutes,
  };
}
