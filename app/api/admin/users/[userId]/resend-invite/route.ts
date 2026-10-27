import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import { resendInviteResponseSchema } from "@/src/features/auth";
import { userParamSchema } from "@/src/features/users";
import { userService } from "@/src/features/users/server";

// ADM-6: the admin re-sends the set-password invite to ANY account that has not set a password yet
// (attendee, organizer or speaker). The old link stops working. No body. 404 unknown user, 409 if
// the account is already active or suspended, 429 within 60 s of the last invite. The response
// never contains the link.
export const POST = route<{ userId: string }>(
  { auth: "signed-in", permission: [PERMISSION.USER_STATUS_MANAGE] },
  async ({ params }) => {
    const { userId } = parseInput(userParamSchema, await params);
    const result = await userService.resendInvite(userId);
    return ok(resendInviteResponseSchema.parse(result));
  },
);
