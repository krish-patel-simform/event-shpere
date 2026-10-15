---
name: auth-roles
description: Authentication and role-based access for EventSphere with Auth.js v5 (NextAuth) + Drizzle adapter + credentials: sign up, login, logout, profile/image/password changes, forgot/reset password, session with id and role, proxy.ts route protection, getCurrentUser/requireRole/requireOwnership guards, and the permission map from spec section 4. Use for anything about users, sessions, roles, protected pages or APIs, profile, or password flows.
---

# Auth & roles (Auth.js v5)

Serves: AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, AUTH-6, AUTH-7, AUTH-8, AUTH-9, ORG-1, ORG-4, STATE-1.
Related: `backend-security` (hashing, tokens, rate limits), `backend-architecture`, `zod-validation`, `state-management` (auth slice), `api-integration` (401 handling).

> Verify Auth.js v5 APIs against its current docs before use (`next-auth@5`, `@auth/drizzle-adapter`); package names and the `proxy.ts` integration changed across releases. If unsure, say so instead of guessing.

## Purpose
One trustworthy source for "who is calling and what may they do", used identically by pages, route handlers and services.

## Permission map (spec §4)
| Capability | GUEST (no session) | USER | ORGANIZER |
| --- | --- | --- | --- |
| Browse / search events; view speakers; view schedules | ✅ | ✅ | ✅ |
| Register for events; bookmark sessions; personal agenda; vote in polls; receive notifications; manage own profile | ❌ | ✅ | ✅ (organizers are also registered users) |
| Create events; manage sessions; publish announcements; manage polls (ORG-4); view analytics | ❌ | ❌ | ✅ **only for events they own** |

DB enum `user_role`: `USER | ORGANIZER`. `GUEST` = absence of a session. Organizer sign-up is not public: seed organizers, or promote a user manually/with an admin script (decide in AUTH-8; document it).

## MUST
- Config in `src/core/auth/config.ts`: `NextAuth({ adapter: DrizzleAdapter(db), session: { strategy: "jwt" }, providers: [Credentials({...})], callbacks: { jwt, session } })`. **Credentials requires JWT sessions**, so the adapter mainly serves user storage. Export `{ handlers, auth, signIn, signOut }`; mount `export const { GET, POST } = handlers` in `app/api/auth/[...nextauth]/route.ts`.
- `authorize()`: Zod-parse credentials, load the user via the **auth repository**, `verifyPassword`, return `{ id, role, name, email, image }` or `null` (one generic failure). Rate limit login.
- Session shape: `{ user: { id, role, firstName, lastName, email, image } }` via `jwt`/`session` callbacks + module augmentation (`declare module "next-auth"`). `jwt` callback also rejects tokens issued before `passwordChangedAt`.
- Guards in `src/core/auth/guards.ts` (server-only), used by the `route()` wrapper and server components:
  - `getCurrentUser()` → actor or `null` (`await auth()`).
  - `requireUser()` → actor or throw `UnauthorizedError`.
  - `requireRole("ORGANIZER")` → actor or `ForbiddenError`.
  - `assertOwnership(resource.ownerId, actor)` → throws `NotFoundError`/`ForbiddenError` (we use 404 for foreign resources).
- **Signup (AUTH-1)** `POST /api/auth/signup`: Zod (`firstName`, `lastName`, `email`, `password`, `confirmPassword` on the form only) → service: normalize email (lowercase), unique check + DB unique constraint, hash, insert role `USER`, optionally sign in. **Login (AUTH-2)** via `signIn("credentials")` from the client form. **Logout (AUTH-9)** `signOut()` + reset Redux (`authSlice`, RTK Query cache `api.util.resetApiState()`).
- **Profile (AUTH-3)** `GET/PATCH /api/me` (first/last name, and other allowed fields only: whitelist via Zod). **Image (AUTH-4)** `POST /api/me/avatar` multipart → validate type/size → upload to Vercel Blob (server-side token) → store URL. **Password (AUTH-5)** `POST /api/me/password` (current + new). **Forgot/reset (AUTH-6, AUTH-7)** as in `backend-security`; email via Resend, or log the link in dev.
- Protect pages three ways: (1) `proxy.ts` early redirect for `(user)`/`(organizer)` routes using a cheap session check (UX only; Next docs say Proxy is not an authorization solution), (2) server components call `requireUser()/requireRole()`, (3) every route/service re-checks. Never rely on (1) or on hiding UI.
- Client auth state: `authSlice` holds `{ status: "loading" | "authenticated" | "anonymous", user }`, hydrated from the server session (SessionProvider or an initial server-fetched value). UI gating (hide "Register" for guests) is cosmetic.

## MUST NOT
- No role/user id taken from request bodies or query strings.
- No password hash or token in `session`, JWT, DTOs, logs.
- No database sessions with the credentials provider (unsupported).
- No `proxy.ts` that queries the database or is the only guard.
- No custom crypto; no storing plain reset tokens.

## Procedure: protect a new endpoint/page
1. Decide the row of the permission map. 2. Route: `route({ auth: "USER" })`. 3. Service: take `actor`, check ownership/rules. 4. Page: `requireUser()` in the server component; unauthenticated → `redirect("/login?callbackUrl=...")`. 5. Test 401/403/404 paths.

## Example: organizer-only analytics (BE-6)
```ts
export const GET = route({ auth: "ORGANIZER" }, async ({ actor, req }) => {
  const query = analyticsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams)); // from, to, eventId?
  return ok(ticketSalesResponseSchema.parse(await analyticsService.ticketSales(actor, query)));
});
// service: if (query.eventId) assertOwnership(event.organizerId, actor); queries always filter organizerId = actor.id
```

## Common mistakes
- Trusting `session.user.role` on the client for authorization.
- Forgetting `await` on `auth()`, `cookies()`, `params`.
- Importing the Node-only password hasher into `proxy.ts`.
- Creating the user without handling the unique email race (catch the unique violation → generic error).
- Not clearing the RTK Query cache on logout (next user sees old data).

## Final checklist
- [ ] Permission map row identified; guard + ownership implemented server-side.
- [ ] Session contains id + role only (no secrets); types augmented.
- [ ] Login/signup/reset rate limited and generic in messages.
- [ ] Logout clears session and client state.
- [ ] Tests: signup validation, login success/failure, role/ownership denials (TEST-1, TEST-3, TEST-2).
