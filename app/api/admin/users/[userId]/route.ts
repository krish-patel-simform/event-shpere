import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ok, parseInput, route } from "@/src/core/http";
import {
  userDetailResponseSchema,
  userParamSchema,
} from "@/src/features/users";
import { userService } from "@/src/features/users/server";

// The admin opens one user (the profile page): the account, the role and what it allows. The same
// for every role; an organizer's application or a speaker's profile are on their own pages.
// 404 if there is no such user. Read with the same permission as the list.
export const GET = route<{ userId: string }>(
  { auth: "signed-in", permission: [PERMISSION.USER_VIEW] },
  async ({ params }) => {
    const { userId } = parseInput(userParamSchema, await params);
    const user = await userService.getUserDetail(userId);
    return ok(userDetailResponseSchema.parse(user));
  },
);
