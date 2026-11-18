import "server-only";
import type { NextRequest } from "next/server";
import { getClientIp } from "./client-ip";
import { consumeRateLimit } from "./rate-limit";
import { errorResponse } from "./response";

// Paths the guard never counts. Monitoring must always get an answer. A future webhook route
// (Stripe, Strapi) belongs here too: providers call in bursts from a few IPs and a dropped
// webhook is a lost payment, so those are verified by their signature instead.
const UNLIMITED_PATHS = new Set(["/api/health"]);

/**
 * The first line of defense, run by proxy.ts before any route code: a loose limit per IP on every
 * API request, so a flood is refused before it costs a session lookup or a database query. It
 * is a flood guard, not the real limit: the tight limits live in route().
 *
 * Returns the 429 to send, or undefined to let the request go on. The policy fails open, so
 * when Redis is down this lets everything through instead of taking the whole API down.
 */
export async function globalRateLimit(
  req: Pick<NextRequest, "headers" | "nextUrl">,
): Promise<Response | undefined> {
  if (UNLIMITED_PATHS.has(req.nextUrl.pathname)) return undefined;

  const decision = await consumeRateLimit("global-ip", getClientIp(req));
  if (decision.allowed) return undefined;

  const response = errorResponse(
    429,
    { code: "RATE_LIMITED", message: "Too many requests, try again later" },
    { "Retry-After": String(decision.retryAfterSeconds) },
  );
  // The route wrapper does not run here, so this response gets its request id from the guard.
  response.headers.set("x-request-id", crypto.randomUUID());
  return response;
}
