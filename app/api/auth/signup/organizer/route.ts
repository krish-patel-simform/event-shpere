import { created, parseBody, route } from "@/src/core/http";
import {
  organizerSignUpResponseSchema,
  organizerSignupBodySchema,
} from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// An organizer registers themselves → pending account + 6-digit code emailed.
// No auth cookies here: the session starts only after the email is verified.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, organizerSignupBodySchema);
  const organizer = await authService.signUpOrganizer(body);
  return created(organizerSignUpResponseSchema.parse(organizer));
});
