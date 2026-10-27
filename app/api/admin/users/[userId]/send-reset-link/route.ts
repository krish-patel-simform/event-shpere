import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { sendResetLinkResponseSchema } from "@/src/features/auth";
import { passwordResetService } from "@/src/features/auth/server";
import { userParamSchema } from "@/src/features/users";

// ADM-9: the admin sends a password reset link to a user. It is the same one-time link and the
// same email as "forgot password" (the user sets a new password on /reset-password); the email
// says an administrator started it. No body. 403 for an administrator, 404 unknown user, 409 if
// the user is pending (use the set-password invite) or suspended, 429 within 60 s of the last
// link, 503 if the email could not be sent. The response never contains the link.
export const POST = route<{ userId: string }>(
  { auth: "signed-in", permission: [PERMISSION.USER_STATUS_MANAGE] },
  async ({ params }) => {
    const { userId } = parseInput(userParamSchema, await params);
    const result = await passwordResetService.sendResetLinkToUser(userId);
    return ok(sendResetLinkResponseSchema.parse(result));
  },
);
