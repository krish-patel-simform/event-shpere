import { ok, PER_USER_HEADERS, route } from "@/src/core/http";
import { meResponseSchema } from "@/src/features/auth";

// `route` has already verified the access token and loaded the user: take it from the args.
// The response is parsed with the same schema the browser uses, so the contract cannot drift.
// It carries the user's email and permissions, so no cache may keep it.
export const GET = route(
  { auth: "signed-in", rateLimit: "user-read" },
  async ({ currentUser }) =>
    ok(
      meResponseSchema.parse({
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: currentUser.email,
        role: currentUser.role,
        // A Set serializes to {} in JSON, so turn it into an array.
        permissions: [...currentUser.permissions].sort(),
      }),
      { headers: PER_USER_HEADERS },
    ),
);
