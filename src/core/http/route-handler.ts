import "server-only";
import type { NextRequest } from "next/server";
import {
  assertPermission,
  requireCurrentUser,
} from "../auth/server/auth-guards";
import type { CurrentUser } from "../auth/server/auth-session";
import { AppError, ForbiddenError } from "./errors";
import { errorResponse } from "./response";

/**
 * Who may call the route. Required on every route, so forgetting it is a compile error
 * (deny by default):
 * - `{ auth: "public" }`: anyone
 * - `{ auth: "signed-in" }`: any valid access token
 * - `{ permission: ["ORGANIZER_CREATE"] }`: signed in AND the role grants every listed permission
 */
export type RouteAuth =
  { auth: "public" } | { auth: "signed-in" } | { permission: string[] };

export type HandlerArgs<P> = {
  req: NextRequest;
  // Still a Promise in this Next.js version: `await params` before using it.
  params: Promise<P>;
  requestId: string;
};

export type SignedInHandlerArgs<P> = HandlerArgs<P> & {
  currentUser: CurrentUser;
};

type PublicHandler<P> = (args: HandlerArgs<P>) => Promise<Response>;
type SignedInHandler<P> = (args: SignedInHandlerArgs<P>) => Promise<Response>;

type NextRouteHandler<P> = (
  req: NextRequest,
  ctx: { params: Promise<P> },
) => Promise<Response>;

/**
 * Wraps every Route Handler: checks auth, gives it a request id, and turns anything thrown
 * into the `{ error: { code, message, details? } }` envelope, so routes never build error JSON.
 *
 *   export const GET = route({ auth: "public" }, async () => ok(await service.list()));
 *   export const POST = route({ permission: ["ORGANIZER_CREATE"] }, async ({ req, currentUser }) => ...);
 *   export const DELETE = route<{ organizerId: string }>({ permission: ["ORGANIZER_MANAGE"] }, async ({ params }) => ...);
 */
export function route<P = Record<string, never>>(
  auth: { auth: "public" },
  handler: PublicHandler<P>,
): NextRouteHandler<P>;
export function route<P = Record<string, never>>(
  auth: { auth: "signed-in" } | { permission: string[] },
  handler: SignedInHandler<P>,
): NextRouteHandler<P>;
export function route<P>(
  auth: RouteAuth,
  handler: PublicHandler<P> | SignedInHandler<P>,
): NextRouteHandler<P> {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID();

    let response: Response;
    try {
      assertSameOrigin(req);
      const args = { req, params: ctx.params, requestId };

      if ("auth" in auth && auth.auth === "public") {
        // The overloads guarantee a public route was given a PublicHandler.
        response = await (handler as PublicHandler<P>)(args);
      } else {
        const currentUser = await requireCurrentUser(); // 401
        if ("permission" in auth)
          assertPermission(currentUser, auth.permission); // 403 if not have an permission
        response = await handler({ ...args, currentUser });
      }
    } catch (error) {
      response = toErrorResponse(error, req, requestId);
    }

    // Quote this id when reporting a problem; it is also in the server log line.
    response.headers.set("x-request-id", requestId);
    return response;
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard: browsers always send `Origin` on a POST/PATCH/DELETE, so a different origin
 * means another site is trying to use the user's cookies. Tools like Postman send no
 * Origin and pass.
 */
function assertSameOrigin(req: NextRequest): void {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    throw new ForbiddenError("Cross-site request blocked");
  }
}

function toErrorResponse(
  error: unknown,
  req: NextRequest,
  requestId: string,
): Response {
  // Expected failures: the service decided the request cannot succeed.
  if (error instanceof AppError) {
    return errorResponse(error.status, {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Unexpected: a bug or an outage. Log the real error, return a generic message so no
  // stack trace or SQL ever reaches the client. (Sentry reporting is added with MON-*.)
  console.error(
    `[${requestId}] ${req.method} ${req.nextUrl.pathname} failed:`,
    error,
  );
  return errorResponse(500, {
    code: "INTERNAL_ERROR",
    message: "Something went wrong",
  });
}
