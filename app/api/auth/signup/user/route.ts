import { created, parseBody, route } from "@/src/core/http";
import {
  userSignupBodySchema,
  userSignupResponseSchema,
} from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// AUTH-1: a user (attendee) registers → pending account + code and verify link emailed.
// No auth cookies here: the session starts at login, after POST /api/auth/verify-email.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, userSignupBodySchema);
  const user = await authService.signUpUser(body);
  return created(userSignupResponseSchema.parse(user));
});
