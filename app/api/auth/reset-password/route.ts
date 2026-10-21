import { noContent, parseBody, route } from "@/src/core/http";
import { resetPasswordBodySchema } from "@/src/features/auth";
import { passwordResetService } from "@/src/features/auth/server";

// AUTH-7: the emailed reset link's token + a new password. On success the password is changed,
// the link is used up and every session of the account is revoked, so the user logs in again.
// No auth cookies here: the person is not logged in (that is why they are resetting).
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, resetPasswordBodySchema);
  await passwordResetService.resetPassword(body);
  return noContent();
});
