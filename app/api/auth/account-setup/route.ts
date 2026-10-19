import { noContent, parseBody, route } from "@/src/core/http";
import { accountSetupBodySchema } from "@/src/features/auth";
import { accountSetupService } from "@/src/features/auth/server";

// AUTH-10: step 1 of the setup email. Token + new password → account active, then log in.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, accountSetupBodySchema);
  await accountSetupService.completeAccountSetup(body);
  return noContent();
});
