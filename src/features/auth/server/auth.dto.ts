import "server-only";
import type { RoleName } from "../../../db/schemas";
import type { AuthUserDto } from "../schemas/auth.schemas";

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
