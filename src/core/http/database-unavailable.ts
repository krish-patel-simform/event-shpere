// Tells "the database cannot take our request right now" (full pool, timeout, restart, too many
// connections) from every other database failure (a bug, a missing table, a unique violation).
// The first is an outage that passes: answer 503 and let the caller retry. The second is ours to
// fix: it stays a 500 (or the 409 a service maps it to).

// Postgres SQLSTATE codes (https://www.postgresql.org/docs/current/errcodes-appendix.html):
// 53300 too many connections, 57P01-57P03 the server is shutting down or not accepting yet.
// Class 08 is every "connection exception".
const UNAVAILABLE_SQLSTATES = new Set(["53300", "57P01", "57P02", "57P03"]);
// Node socket errors: nobody listening, connection dropped, no answer in time. These are not
// specific to Postgres: a closed rate-limit policy rethrowing a Redis outage lands here too, and
// "busy, try again" is the right answer for that as well.
const UNAVAILABLE_SOCKET_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
]);
// ioredis: Redis is unreachable and the command gave up after `maxRetriesPerRequest` tries (see
// core/redis/redis.ts). It has no `code` and its message is long, so it is matched by its name.
// This is what a fail-closed limit (login attempts, auth-ip, user-write) throws while Redis is
// down: a 503 "try again shortly", not a 500 as if the code had a bug.
const UNAVAILABLE_ERROR_NAMES = new Set(["MaxRetriesPerRequestError"]);
// node-postgres: the pool waited `connectionTimeoutMillis` for a free connection, or the
// connection died. Matched at the START of the message, so a query that merely mentions these
// words (a Drizzle "Failed query: ..." message) never matches.
const UNAVAILABLE_MESSAGE =
  /^(timeout exceeded when trying to connect|Connection terminated)/;

// Drizzle wraps the driver's error as `cause`; the pool adds its own cause too.
const MAX_CAUSE_DEPTH = 5;

function isUnavailableLink(error: Error): boolean {
  if (UNAVAILABLE_ERROR_NAMES.has(error.name)) return true;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    if (UNAVAILABLE_SQLSTATES.has(code)) return true;
    if (UNAVAILABLE_SOCKET_CODES.has(code)) return true;
    if (code.startsWith("08")) return true;
  }
  return UNAVAILABLE_MESSAGE.test(error.message);
}

/** True when the error, or anything it wraps, says the database could not be reached or is full. */
export function isDatabaseUnavailable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) return false;
    if (isUnavailableLink(current)) return true;
    current = current.cause;
  }
  return false;
}
