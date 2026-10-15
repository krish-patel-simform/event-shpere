---
name: error-handling-monitoring
description: Error handling and observability for EventSphere: React error boundaries (error.tsx, global-error.tsx), API failure handling, network interruption detection, missing-data states, Sentry on client and server (exceptions, unhandled promise rejections, API failures), source maps, request IDs, structured logs, and keeping PII out. Use when handling failures, setting up Sentry or logging, adding error/not-found pages, or reviewing how a feature fails.
---

# Error handling & monitoring

Serves: ERR-1, ERR-2, ERR-3, ERR-4, MON-1, MON-2, MON-3, BE-8, SETUP-3, QUAL-1.
Related: `api-integration` (client errors), `backend-architecture` (domain errors), `ui-implementation` (error UI), `pwa-offline`, `backend-security` (no PII).

> Verify the current `@sentry/nextjs` setup for Next.js 16 (`npx @sentry/wizard@latest -i nextjs`; files `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `withSentryConfig`, `onRequestError`). Say so if unsure; read the generated files rather than recalling them.

## Purpose
Every failure is **handled for the user** (clear message + recovery) and **visible to the developer** (Sentry + logs), without leaking sensitive data.

## Error taxonomy
| Kind | Example | User sees | Sentry? |
| --- | --- | --- | --- |
| Validation (400) | invalid email | inline field errors (ERR-2) | no |
| Auth (401/403) | expired session / not organizer | redirect to login / "You don't have access" | no |
| Not found / missing data (404, null CMS entry) | deleted event | friendly "not found" / empty state (ERR-4) | no |
| Conflict (409) | `EVENT_FULL` | specific message ("This event just sold out") | no |
| Server (5xx) | DB down | "Something went wrong, try again" + request id | **yes** (MON-3) |
| Network | offline, DNS | offline banner, retry on reconnect (ERR-3) | no (expected) unless repeated |
| Contract (`INVALID_RESPONSE`) | API shape mismatch | generic error | **yes** |
| Uncaught render error | bug in component | error boundary UI | **yes** (MON-1) |
| Unhandled rejection | forgotten `await`/promise | nothing visible | **yes** (MON-2) |

## MUST
- **Error boundaries**: `app/error.tsx` (segment-level, with `reset()` button), `app/global-error.tsx` (root layout failures; includes `<html><body>`), `app/not-found.tsx`; add `error.tsx` per important route group (`(user)`, `(organizer)`) with context-specific copy. Boundaries call `Sentry.captureException(error)` (client) in `useEffect`.
- **Client Sentry** (`instrumentation-client.ts`): `Sentry.init({ dsn: NEXT_PUBLIC_SENTRY_DSN, environment, release, tracesSampleRate, beforeSend: scrubPII })`. Default integrations capture **uncaught exceptions and unhandled promise rejections** (MON-1, MON-2); verify by throwing in a dev-only test route and by `Promise.reject(new Error(...))` from the console.
- **Server Sentry**: `instrumentation.ts` registers server config; export `onRequestError` so route-handler/RSC errors are captured; the `route()` wrapper captures **unexpected** errors (not domain errors) with tags `{ route, requestId }` (MON-3 server side).
- **API failure capture (MON-3 client side)**: in `baseQueryWithGuards` (`api-integration`) report 5xx, `INVALID_RESPONSE`, repeated network errors with `Sentry.captureException(new ApiClientError(...))` and tags `{ endpoint, status, requestId }`. Not 4xx domain errors.
- **Request IDs**: wrapper creates/propagates `x-request-id`, adds it to logs, the error response (`error.details.requestId` or header), and Sentry tag; error UI displays it ("Reference: abc123").
- **Structured logging** (`core/http/logger.ts`, e.g. pino): JSON lines with `level, msg, requestId, route, userId?, durationMs`; **no PII** (no emails, names, tokens, passwords, payloads). Redact by key list. Log at `info` for requests, `warn` for domain errors, `error` for unexpected.
- **Network interruptions (ERR-3)**: `useOnlineStatus` (online/offline events + failed fetch heuristic), offline banner, retry with backoff for idempotent GETs (RTK `retry` wrapper), mutations show "You're offline: try again when connected" instead of failing silently.
- **Missing data (ERR-4)**: schemas allow optional where the product allows it; components render fallbacks ("Speaker details coming soon"); `notFound()` for unknown slugs; never `undefined.map`.
- **Source maps**: `withSentryConfig` uploads source maps in CI using `SENTRY_AUTH_TOKEN` (secret, not in repo); set `release` to the git SHA; hide source maps from public bundles per Sentry's option.
- **Scrubbing**: `beforeSend` removes `request.cookies`, auth headers, emails/IPs; `sendDefaultPii: false`; set only `user.id`.
- Messages: plain language, actionable, no codes alone ("We couldn't load events. Check your connection and try again.").

## MUST NOT
- No empty `catch {}`; no `console.error` as the only handling; no swallowing errors in RTK/handlers.
- No reporting expected 4xx or user typos to Sentry (noise hides real problems).
- No stack traces, SQL or internal messages in UI/API responses.
- No secrets/PII in logs, breadcrumbs, or Sentry context.
- No Sentry DSN/auth token confusion: DSN is public-OK; auth token is secret.

## Procedure: make a feature fail well
1. List its failure modes (taxonomy above). 2. Server: domain errors for expected, wrapper for unexpected. 3. Client: error UI per mode (inline, toast, boundary). 4. Verify Sentry receives the right ones with request id. 5. Test: mocked 500/network/404/invalid-response in RTL + MSW; Playwright offline.

## Example: client reporting in baseQuery (MON-3)
```ts
if (result.error) {
  const err = normalizeApiError(result.error);
  if (err.status >= 500 || err.code === "INVALID_RESPONSE") Sentry.captureException(err, { tags: { endpoint: args.url, status: err.status, requestId: err.requestId } });
  if (err.status === 401) api.dispatch(sessionExpired());
  return { error: err };
}
```

## Common mistakes
- `global-error.tsx` missing `<html>`/`<body>`.
- Sentry events full of 404/validation noise → real errors ignored.
- Source maps not uploaded → unreadable stacks.
- Logging `req.body` (passwords!) in the wrapper.
- Offline state shown as "server error".

## Final checklist
- [ ] Boundaries + not-found pages present; they report to Sentry.
- [ ] Client + server Sentry active; unhandled rejections and API failures verified.
- [ ] Request id flows UI → logs → Sentry.
- [ ] PII scrubbed; logs structured and redacted.
- [ ] Each failure mode has a user-facing state and a test.
