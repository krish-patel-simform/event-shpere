import { created, parseBody, route } from "@/src/core/http";
import {
  organizerSignupBodySchema,
  signupResponseSchema,
} from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// An organizer registers themselves → pending account + 6-digit code emailed.
// No auth cookies here: the session starts only after the email is verified.
// 201 whether or not the email already has an account (nothing is created or sent for a known
// one), so the response never reveals which emails are registered.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, organizerSignupBodySchema);
  const answer = await authService.signUpOrganizer(body);
  return created(signupResponseSchema.parse(answer));
});
