---
name: backend-architecture
description: EventSphere backend layering (route handler → service → repository), DTO mapping, domain errors, dependency direction, transaction placement, testable services via injected repositories, and background jobs such as the Vercel Cron event reminders. Use when writing or reviewing anything under src/features/*/server, app/api/**/route.ts, services, repositories, domain errors, or scheduled jobs.
---

# Backend architecture (route → service → repository)

Serves: BE-4, BE-5, BE-6, BE-8, REG-1, NOTIF-1, NOTIF-2, NOTIF-3, TEST-3.
Related: `api-design` (HTTP contract), `database-drizzle` (queries/transactions), `backend-security`, `testing`.

## Purpose
Keep HTTP, business rules and SQL in separate layers so each can be tested alone, and so "who is allowed to do what and when" lives in exactly one place (the service).

## Layer responsibilities
| Layer | Lives in | Does | Never does |
| --- | --- | --- | --- |
| Route handler | `src/app/api/**/route.ts` | Auth guard, parse params/query/body with Zod, call **one** service method, return envelope | Business rules, SQL, Drizzle imports, hand-built error JSON |
| Service | `features/<f>/server/service.ts` | Business rules (seat check, who may cancel, poll option limits), orchestration of repositories, **opens transactions**, throws domain errors, returns DTOs | Know about `Request`/`Response`/cookies, build SQL, return raw rows |
| Repository | `features/<f>/server/repository.ts` | The **only** place with Drizzle queries; accepts an optional `tx`; returns typed rows / plain data | Business decisions, auth, HTTP, throwing HTTP errors |
| DTO mapper | `features/<f>/server/dto.ts` | Maps rows → response DTOs (dates to ISO, drop `passwordHash`, rename fields) | Query the DB |

Direction: `route → service → repository → core/db`. Services may call **other features' services** (through their `server` barrel) but never their repositories.

## MUST
- Route handlers use the wrapper from `src/core/http/route-handler.ts` (adds request id, logging, error → envelope mapping, Sentry for unexpected errors). Success: `{ data }` (+ `meta` for pages); failure: `{ error: { code, message, details? } }`.
- Domain errors live in `src/core/http/errors.ts` and map to statuses in one place:

| Error class | Status | `code` |
| --- | --- | --- |
| `ValidationError` | 400 | `VALIDATION_ERROR` (details = Zod flattened issues) |
| `UnauthorizedError` | 401 | `UNAUTHENTICATED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | e.g. `EVENT_FULL`, `ALREADY_REGISTERED`, `POLL_CLOSED` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| anything else | 500 | `INTERNAL_ERROR` (generic message; real error goes to logs + Sentry) |

- Services are **factories with injected dependencies** so tests pass fakes:
  ```ts
  export function createRegistrationsService(deps: {
    registrationsRepo: RegistrationsRepo;
    eventsRepo: EventsRepo;
    withTransaction: typeof withTransaction;
    notifications: Pick<NotificationsService, "create">;
  }) { /* ... */ }
  export const registrationsService = createRegistrationsService({ /* real deps */ });
  ```
- **Transactions live in the service** (it knows what must be atomic): `deps.withTransaction(async (tx) => { ...repo.method(args, tx) })`. `withTransaction` (from `core/db/transaction.ts`) is the only db-client import a service may use. Repositories take `tx?: DbOrTx` as the last argument and default to the shared db.
- Services return **DTOs** (or plain domain objects mapped by `dto.ts`). Never leak `$inferSelect` rows, never include `passwordHash`, tokens, internal ids you do not expose.
- Authorization **decisions** (ownership, role-dependent rules) are made in the service from an explicit `actor: { id; role }` argument; the route only authenticates and passes the actor in. (See `backend-security`.)
- Log with the structured logger (`requestId`, `userId`, feature, action); never log passwords, tokens, full emails or Stripe payloads.

## MUST NOT
- No Drizzle/`db` import outside `repository.ts` (+ `core/db`, seed script, migrations, tests). A lint rule enforces this.
- No `NextRequest`/`Response` in services or repositories.
- No try/catch in routes that swallows errors or crafts `NextResponse.json({ error })` by hand.
- No fire-and-forget promises for must-happen work (e.g. creating a notification after registration): do it inside the transaction, or use `after()` from `next/server` only for best-effort extras (verify in docs `after.md`).

## Procedure: add an endpoint end-to-end
1. Table + migration (`database-drizzle`). 2. Repository method(s) with `tx?`. 3. DTO mapper. 4. Service method: validate business rules, throw domain errors, wrap multi-step writes in `withTransaction`. 5. Zod schemas (`zod-validation`). 6. Route with the wrapper. 7. Service unit test (fake repos) + one route/repository integration test (`testing`).

## Example: register for an event (REG-1, REG-4)
```ts
// features/registrations/server/service.ts (shape, not the full solution)
async register(actor: Actor, eventId: string) {
  return deps.withTransaction(async (tx) => {
    const event = await deps.eventsRepo.findByIdForUpdate(eventId, tx);   // SELECT ... FOR UPDATE
    if (!event || event.status !== "published") throw new NotFoundError("Event not found");
    const taken = await deps.registrationsRepo.countActive(eventId, tx);
    if (taken >= event.capacity) throw new ConflictError("EVENT_FULL", "This event is sold out");
    const existing = await deps.registrationsRepo.findByUserAndEvent(actor.id, eventId, tx);
    if (existing && existing.status !== "cancelled") throw new ConflictError("ALREADY_REGISTERED", "You are already registered");
    const status = event.priceCents === 0 ? "confirmed" : "pending_payment";
    const row = await deps.registrationsRepo.upsert({ userId: actor.id, eventId, status }, tx);
    if (status === "confirmed") await deps.notifications.create(actor.id, "registration_confirmed", { eventId }, tx);
    return toRegistrationDto(row);
  });
}
```
The route:
```ts
export const POST = route({ auth: "USER" }, async ({ actor, params }) => {
  const { eventId } = eventIdParamSchema.parse(await params);
  const dto = await registrationsService.register(actor, eventId);
  return created(registrationResponseSchema.parse(dto));   // 201 { data }
});
```
The unique constraint `(user_id, event_id)` is the backstop for two racing requests; the service maps the unique-violation to `ALREADY_REGISTERED`.

## Background jobs (NOTIF-1 reminders)
- Vercel Cron calls `GET /api/cron/reminders` on the schedule in `vercel.json`; the handler verifies `Authorization: Bearer ${CRON_SECRET}` (reject otherwise) and calls `notificationsService.sendDueEventReminders(now)`.
- The job is **idempotent**: a `reminder_sent_at` / unique `(user_id, event_id, type)` notification key prevents double reminders if cron runs twice.
- Work in small batches and bound the runtime (serverless time limit). Cron routes are not user routes: no session, only the secret.

## Common mistakes
- Putting the seat check in the route or in the client ("tickets left" is display-only; the service re-checks inside the transaction).
- Checking-then-inserting without a lock/unique constraint (race condition → overselling).
- Repositories that "helpfully" throw `NotFoundError` (return `null`; the service decides).
- Services that call `db.select()` "just this once".
- Returning `Date` objects and relying on JSON serialization instead of mapping to ISO strings in the DTO.

## Final checklist
- [ ] Route: guard → Zod parse → one service call → envelope; no logic.
- [ ] Service: rules + transaction + domain errors + DTO; dependencies injected.
- [ ] Repository: only queries, optional `tx`, no business decisions.
- [ ] No raw rows or sensitive fields in any response.
- [ ] Domain errors used (not strings / ad-hoc status codes).
- [ ] Unit test with fake repos + an integration test for the repository or route.
