import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { paginated, parseQuery, route } from "@/src/core/http";
import {
  getUsersQueryParams,
  getUsersResponseSchema,
} from "@/src/features/users";
import { userService } from "@/src/features/users/server";

// The admin's Users list: filter by role / status / search, sort, page. Admin only (USER_VIEW):
// the rows include email addresses.
export const GET = route(
  { auth: "signed-in", permission: [PERMISSION.USER_VIEW] },
  async ({ req }) => {
    const query = parseQuery(req, getUsersQueryParams);
    const { items, meta } = await userService.getUsers(query);
    return paginated(getUsersResponseSchema.parse(items), meta);
  },
);
