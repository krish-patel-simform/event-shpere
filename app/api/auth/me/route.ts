import { ok, route } from "@/src/core/http";

// `route` has already verified the access token and loaded the user: take it from the args.
export const GET = route({ auth: "signed-in" }, async ({ currentUser }) =>
  ok({
    id: currentUser.id,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    email: currentUser.email,
    role: currentUser.role,
    // A Set serializes to {} in JSON, so turn it into an array.
    permissions: [...currentUser.permissions].sort(),
  }),
);
