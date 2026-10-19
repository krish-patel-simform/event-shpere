import { noContent, parseBody, route } from "@/src/core/http";
import { verifyEmailBodySchema } from "@/src/features/auth";
import { accountActivationService } from "@/src/features/auth/server";

// Self-signup step 2: the token from the email link + the 6-digit code → account active,
// then the user logs in. No auth cookies here, same as account setup.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, verifyEmailBodySchema);
  await accountActivationService.verifyEmail(body);
  return noContent();
});
