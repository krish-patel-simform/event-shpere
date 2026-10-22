import { ok, route } from "@/src/core/http";
import { meResponseSchema } from "@/src/features/auth";

// `route` has already verified the access token and loaded the user: take it from the args.
// The response is parsed with the same schema the browser uses, so the contract cannot drift.
export const GET = route({ auth: "signed-in" }, async ({ currentUser }) =>
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
  ),
);
