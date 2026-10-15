---
name: backend-security
description: Backend security rules for EventSphere: password hashing, password-reset tokens (random, hashed, expiring, single-use), authorization and ownership checks, rate limiting, input validation, avoiding user enumeration, safe error messages, Stripe/cron/CMS webhook verification, CSRF with Auth.js, secrets and env handling, no sensitive fields in DTOs. Use when touching auth, passwords, tokens, /api/me or organizer routes, webhooks, cron routes, env variables, or when reviewing backend changes for security.
---

# Backend security

Serves: BE-7, AUTH-1, AUTH-2, AUTH-5, AUTH-6, AUTH-7, AUTH-8, REG-5, POLL-3, NOTIF-1, CMS-3, QUAL-1.
Related: `auth-roles` (session/guards), `api-design`, `backend-architecture`, `payments-stripe`. Used by the `security-reviewer` subagent.

## Purpose
Make "secure by default" the only easy path: deny unless allowed, validate everything, expose nothing extra, keep secrets server-side.

## MUST
**Passwords**
- Hash with bcrypt (`bcryptjs`, cost ≥ 12) or argon2id (`@node-rs/argon2`). Pick one in AUTH-1 and wrap it in `core/auth/password.ts` (`hashPassword`, `verifyPassword`). Compare with the library, never `===`.
- Password policy via Zod (min 8–12 chars, max 72 for bcrypt, not equal to email). Change-password (AUTH-5) requires the **current** password and invalidates other sessions (bump `passwordChangedAt`; the JWT callback rejects tokens issued before it).

**Reset tokens (AUTH-6, AUTH-7)**
- Generate `crypto.randomBytes(32).toString("base64url")`; email the raw token in the link; store only `sha256(token)` in `password_reset_tokens` with `expiresAt` (≈ 1 hour) and `usedAt`.
- Consume in one transaction: find by hash, check not expired / not used, update password, set `usedAt`, delete other tokens of that user, bump `passwordChangedAt`.
- Forgot-password **always responds the same** (`200 { data: { message: "If an account exists, we sent an email" } }`) whether the email exists or not, and with similar timing. Never put the token in logs in production; in dev the link may be logged to the console.

**AuthZ**
- Deny by default: every route declares `auth: "PUBLIC" | "USER" | "ORGANIZER"`; a route without an explicit declaration fails a test/lint rule.
- **Ownership** in the service: `/api/me/*` resources are always queried with `actor.id`; organizer resources are checked with `event.organizerId === actor.id` (e.g. an organizer cannot edit or view analytics of someone else's event). Return `404` for resources the actor does not own.
- Role comes from the **session/DB**, never from the request body or client state.

**Validation & output**
- Zod-parse params, query and body on every route (`zod-validation`); drizzle query builder only (parameterized). Escape `%`/`_` for `ilike` searches.
- Parse every response with a response schema; DTOs exclude `passwordHash`, token hashes, `stripe*` secrets, internal flags. Error messages are generic for 500s; no stack traces, SQL, or "email not found" vs "wrong password" differences (login returns one generic message).

**Rate limiting (BE-7)**
- Apply to login, signup, forgot/reset password, vote, and avatar upload (e.g. 5 attempts/min per IP+email for login; 3/hour per email for reset). Implementation behind `core/http/rate-limit.ts` (Upstash Ratelimit, or a Postgres counter table as a fallback; check docs). Return `429` + `Retry-After`.

**Webhooks & machine routes**
- Stripe: verify signature with the **raw body** (`await req.text()`) and `STRIPE_WEBHOOK_SECRET`; reject otherwise; process idempotently (`payments-stripe`).
- CMS revalidate: compare a shared secret from a header with a timing-safe comparison (`crypto.timingSafeEqual`).
- Cron: require `Authorization: Bearer ${CRON_SECRET}`.
- These routes must not use session auth and must not trust the payload beyond verified data.

**CSRF / cookies**
- Auth.js protects its own endpoints with CSRF tokens and sets `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookies. For custom state-changing JSON routes: require `Content-Type: application/json` and verify the `Origin`/`Host` header matches the app (reject cross-site), since `SameSite=Lax` already blocks most cross-site POSTs. Server Actions have a built-in origin check (verify in Next docs `guides/data-security.md`).

**Secrets & env**
- All secrets in env, validated at startup by `core/config/env.ts` (Zod); server vars never prefixed `NEXT_PUBLIC_`; `.env*` git-ignored (already) and read-denied for Claude. Only `NEXT_PUBLIC_*` values (e.g. Stripe publishable key, Sentry DSN) reach the client. Rotate any secret that was ever committed or pasted.
- Stripe amounts come from the **database price**, never from the client.
- Uploads (AUTH-4): allow-list MIME types (png/jpeg/webp), max size (e.g. 2 MB), generate the storage key server-side, never trust the file name.

**Logging**
- Structured logs with `requestId`; never log passwords, tokens, Authorization headers, full card/Stripe payloads, or PII beyond the user id. Sentry events scrub emails/IPs (`beforeSend`).

## MUST NOT
- No `dangerouslySetInnerHTML` with CMS/user content without sanitizing; no `sql.raw` with user input; no `eval`/dynamic requires.
- No secrets in client bundles, `next.config.ts` `env`, logs, tests, fixtures or commits.
- No trusting `userId`, `role`, `price`, `status` from the request.
- No account existence leaks (signup "email already used" is acceptable only if you also rate-limit; prefer a generic message plus email, discuss in AUTH-1).
- No disabling Sonar/ESLint security rules to make CI pass.

## Procedure: security pass on a new route
1. Who may call it? Declare `auth`. 2. What does it touch? Prove ownership in the service. 3. Parse inputs/outputs with Zod. 4. Is it abusable (login, vote, reset, upload)? Add rate limit. 5. What could leak? Check the DTO. 6. Write negative tests: unauthenticated → 401, wrong role → 403, someone else's id → 404, bad body → 400, too many → 429.

## Example: vote route (POLL-1, POLL-3)
`POST /api/polls/[pollId]/votes` → `auth: "USER"`, rate limit per user, body `{ optionIds: uuid[] }`. Service: poll must be `open` and belong to an event the user is registered for (or published), `optionIds` must belong to the poll, count = 1 for single / ≤ `maxChoices` for multiple, insert ballot; the unique `(pollId, userId)` violation maps to `ConflictError("ALREADY_VOTED")`.

## Common mistakes
- Hashing the reset token with a fast hash but never expiring it, or leaving it reusable.
- Checking the role in the UI only.
- `req.json()` before verifying the Stripe signature (the raw body must be unchanged).
- Leaking different errors for "no such user" vs "wrong password".
- Using `Math.random()` for tokens.
- Putting `CRON_SECRET`/webhook secrets in `NEXT_PUBLIC_*`.

## Final checklist
- [ ] Route declares auth; service checks ownership; 404 for foreign resources.
- [ ] Inputs parsed, outputs parsed, DTO free of sensitive fields.
- [ ] Hashing/token handling per rules; reset flow generic + single-use + expiring.
- [ ] Rate limit on auth/vote/reset; webhooks/cron verified.
- [ ] Secrets only server-side and validated; nothing sensitive in logs/Sentry.
- [ ] Negative tests exist for 401/403/404/400/429.
