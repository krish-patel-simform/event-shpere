import { noContent, parseBody, route } from "@/src/core/http";
import { resendOtpBodySchema } from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// Resend the email verification code and link. Always 204, whether or not a pending account
// exists, so the response never reveals which emails are registered. A new code and link
// replace the old ones: only the newest email works.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, resendOtpBodySchema);
  await authService.resendOtp(body);
  return noContent();
});
