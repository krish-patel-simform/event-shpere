import { noContent, parseBody, route } from "@/src/core/http";
import { forgotPasswordBodySchema } from "@/src/features/auth";
import { passwordResetService } from "@/src/features/auth/server";

// AUTH-6: "forgot password". 204 whether or not an account exists, so the response never
// reveals which emails are registered. An active account is emailed a one-time link.
// Exception: an admin account gets 400 (validation error), admins never reset by email link.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, forgotPasswordBodySchema);
  await passwordResetService.requestReset(body);
  return noContent();
});
