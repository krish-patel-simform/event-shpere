import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  userParamSchema,
  userStatusResponseSchema,
} from "@/src/features/users";
import { userService } from "@/src/features/users/server";

// ADM-8: the admin lets a suspended user back in. No body. 404 unknown user, 409 if the user is
// not suspended. Same permission as suspending.
export const POST = route<{ userId: string }>(
  { auth: "signed-in", permission: [PERMISSION.USER_STATUS_MANAGE] },
  async ({ params }) => {
    const { userId } = parseInput(userParamSchema, await params);
    const user = await userService.reactivateUser(userId);
    return ok(userStatusResponseSchema.parse(user));
  },
);
