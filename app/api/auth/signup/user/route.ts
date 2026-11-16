import { created, parseBody, route } from "@/src/core/http";
import {
  signupResponseSchema,
  userSignupBodySchema,
} from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// AUTH-1: a user (attendee) registers → pending account + code and verify link emailed.
// No auth cookies here: the session starts at login, after POST /api/auth/verify-email.
// 201 whether or not the email already has an account (nothing is created or sent for a known
// one), so the response never reveals which emails are registered.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, userSignupBodySchema);
  const answer = await authService.signUpUser(body);
  return created(signupResponseSchema.parse(answer));
});
