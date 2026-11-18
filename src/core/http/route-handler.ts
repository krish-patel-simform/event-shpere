import "server-only";
import type { NextRequest } from "next/server";
import {
  assertPermission,
  requireCurrentUser,
} from "../auth/server/auth-guards";
import type { CurrentUser } from "../auth/server/auth-session";
import { getClientIp } from "./client-ip";
import { isDatabaseUnavailable } from "./database-unavailable";
import {
  AppError,
  ForbiddenError,
  RateLimitError,
  ServiceUnavailableError,
} from "./errors";
import { assertRateLimit } from "./rate-limit";
import type {
  IpRateLimitPolicyName,
  RateLimitPolicyName,
  UserRateLimitPolicyName,
} from "./rate-limit-policies";
import { errorResponse } from "./response";
import { describeError } from "./safe-error";

/**
 * Who may call the route. Required on every route, so forgetting it is a compile error
 * (deny by default):
 * - `{ auth: "public" }`: anyone
 * - `{ auth: "signed-in" }`: any valid access token
 * - `{ permission: ["ORGANIZER_CREATE"] }`: signed in AND the role grants every listed permission
 */
export type RouteAuth =
  | ({ auth: "public" } & PublicRateLimitOption)
  | (({ auth: "signed-in" } | { permission: string[] }) &
      SignedInRateLimitOption);

/**
 * Which rate limit applies, by name from rate-limit-policies.ts. Every route names its own, so
 * a reader sees the limit in the route file. It is typed as optional only so that a route that
 * forgets still gets the default for its kind (see defaultRateLimit): a safety net, not the plan
 * (a test fails when a route has no `rateLimit`). `"none"` turns the limit off and must be a
 * deliberate choice (health, logout).
 *
 * A public route counts by IP and a signed-in route by user id, so each accepts only the
 * policies of its kind: a wrong pairing does not compile.
 */
type PublicRateLimitOption = { rateLimit?: IpRateLimitPolicyName | "none" };
type SignedInRateLimitOption = { rateLimit?: UserRateLimitPolicyName | "none" };

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
  auth: { auth: "public" } & PublicRateLimitOption,
  handler: PublicHandler<P>,
): NextRouteHandler<P>;
export function route<P = Record<string, never>>(
  auth: ({ auth: "signed-in" } | { permission: string[] }) &
    SignedInRateLimitOption,
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
        // A public caller has no verified identity: the IP is the only key.
        await applyRateLimit(
          auth.rateLimit ?? defaultRateLimit(req.method, false),
          getClientIp(req),
        );
        // The overloads guarantee a public route was given a PublicHandler.
        response = await (handler as PublicHandler<P>)(args);
      } else {
        const currentUser = await requireCurrentUser(); // 401
        // The key is the verified session's user id, never anything the request sends. It is
        // checked before the permission, so a user who keeps probing routes they may not use
        // is counted too.
        await applyRateLimit(
          auth.rateLimit ?? defaultRateLimit(req.method, true),
          currentUser.id,
        );
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
 * The limit a route gets when it names none. Reads are looser than writes, and the only public
 * writes are the auth routes (login, signup, password reset), which get the strict limit.
 */
function defaultRateLimit(
  method: string,
  signedIn: boolean,
): RateLimitPolicyName {
  const isRead = SAFE_METHODS.has(method);
  if (signedIn) return isRead ? "user-read" : "user-write";
  return isRead ? "public-read-ip" : "auth-ip";
}

async function applyRateLimit(
  policy: RateLimitPolicyName | "none",
  key: string,
): Promise<void> {
  if (policy !== "none") await assertRateLimit(policy, key);
}

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

/** A refused or deferred caller is told how long to wait. Every other error has no header to send. */
function retryAfterHeaders(error: AppError): HeadersInit | undefined {
  if (
    (error instanceof RateLimitError ||
      error instanceof ServiceUnavailableError) &&
    error.retryAfterSeconds !== undefined
  ) {
    return { "Retry-After": String(error.retryAfterSeconds) };
  }
  return undefined;
}

// When the database cannot take a connection (the pool already waited DB_CONNECTION_TIMEOUT_MS),
// tell the caller to come back in a few seconds, so retries spread out instead of piling up.
const BUSY_RETRY_AFTER_SECONDS = 5;

function appErrorResponse(error: AppError): Response {
  return errorResponse(
    error.status,
    {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
    retryAfterHeaders(error),
  );
}

// Unexpected: a bug or an outage. The log gets what kind of error and where, never the raw
// error: a database error carries the query and its values (emails, names). Search the logs by
// the request id, which is also the x-request-id response header. (Sentry reporting is added
// with MON-*; send describeError(error) there too, not the raw error.)
function logUnexpected(
  error: unknown,
  req: NextRequest,
  requestId: string,
): void {
  console.error(
    `[${requestId}] ${req.method} ${req.nextUrl.pathname} failed:`,
    describeError(error),
  );
}

function toErrorResponse(
  error: unknown,
  req: NextRequest,
  requestId: string,
): Response {
  // Expected failures: the service decided the request cannot succeed.
  if (error instanceof AppError) return appErrorResponse(error);

  // Load shedding: a full or unreachable database is an outage that passes, not a bug. A quick
  // "busy, retry" beats a request that hangs. The body is generic: it never says what is down.
  if (isDatabaseUnavailable(error)) {
    logUnexpected(error, req, requestId);
    return appErrorResponse(
      new ServiceUnavailableError(
        "SERVICE_BUSY",
        "The service is busy, try again shortly",
        BUSY_RETRY_AFTER_SECONDS,
      ),
    );
  }

  // Any other failure is a bug: a generic message, so no stack trace or SQL ever reaches the client.
  logUnexpected(error, req, requestId);
  return errorResponse(500, {
    code: "INTERNAL_ERROR",
    message: "Something went wrong",
  });
}
