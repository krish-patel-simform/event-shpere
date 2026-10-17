import { writeAuthCookies } from "@/src/core/auth/server/auth-cookies";
import { ok, parseBody, route } from "@/src/core/http";
import { authUserResponseSchema, loginBodySchema } from "@/src/features/auth";
import { authService } from "@/src/features/auth/server";

// AUTH-2: email + password → access & refresh token cookies + who signed in.
export const POST = route({ auth: "public" }, async ({ req }) => {
  const body = await parseBody(req, loginBodySchema);
  const { user, tokens } = await authService.login(
    body,
    req.headers.get("user-agent"),
  );
  await writeAuthCookies(tokens);
  return ok(authUserResponseSchema.parse(user));
});
