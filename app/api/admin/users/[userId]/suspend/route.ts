import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  userParamSchema,
  userStatusResponseSchema,
} from "@/src/features/users";
import { userService } from "@/src/features/users/server";

// ADM-7: the admin suspends a user: no more login, their sessions end. No body. 403 for yourself
// or an administrator, 404 unknown user, 409 if the user is not active.
export const POST = route<{ userId: string }>(
  { auth: "signed-in", permission: [PERMISSION.USER_STATUS_MANAGE] },
  async ({ params, currentUser }) => {
    const { userId } = parseInput(userParamSchema, await params);
    const user = await userService.suspendUser(userId, currentUser.id);
    return ok(userStatusResponseSchema.parse(user));
  },
);
