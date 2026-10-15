---
name: database-drizzle
description: PostgreSQL with Drizzle ORM and drizzle-kit for EventSphere: pgTable definitions per feature, pgEnum, timestamptz, ids, foreign keys and onDelete, unique constraints and indexes, relations, $inferSelect/$inferInsert, schema barrel, generate/migrate workflow (never push), seed script, transactions, relational vs query-builder queries, SQL aggregations for analytics, pagination, N+1, and local Docker vs Neon driver setup. Use for any schema, migration, query, seed or analytics work, and for /design-table and /db-migrate.
---

# Database with Drizzle (PostgreSQL)

Serves: BE-1, BE-2, BE-3, BE-6, REG-1, REG-5, AGD-3, POLL-3, POLL-4, ORG-4, DISC-4, DASH-1, DASH-2, DASH-3, DASH-4, DASH-5, BONUS-4 (keyset pagination later).
Related: `backend-architecture`, `zod-validation` (drizzle-zod), `testing` (test DB). Table overview for EventSphere: [references/schema-overview.md](references/schema-overview.md).

## Purpose
Model transactional data correctly (constraints enforce integrity, not just application code) and evolve it through reviewed, committed migrations.

## MUST
- **One schema file per feature**: `src/features/<f>/server/db/schema.ts`; re-export all of them from the barrel `src/core/db/schema.ts`. `drizzle.config.ts` points at the barrel:
  ```ts
  export default defineConfig({ dialect: "postgresql", schema: "./src/core/db/schema.ts", out: "./drizzle",
    dbCredentials: { url: process.env.DATABASE_URL! } });
  ```
- Ids: `uuid("id").primaryKey().defaultRandom()` for public entities; `serial`/`identity` only for internal logs.
- Timestamps: `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`; `updated_at` with `$onUpdate(() => new Date())`. Store event/session times in UTC; format in the UI.
- Enums with `pgEnum` (`user_role`, `event_type`, `registration_status`, `payment_status`, `poll_type`, `notification_type`). Adding enum values needs a migration: review it.
- Money as integer cents (`priceCents`) + `currency` text; never floats.
- **Foreign keys with explicit `onDelete`** (`cascade` for owned children like `poll_options`; `restrict` for things that must not vanish, e.g. paid registrations; `set null` for optional links).
- **Constraints carry the rules**: `unique("registrations_user_event_uq").on(userId, eventId)`; `unique().on(userId, sessionId)` for agenda and bookmarks; one ballot per user per poll; `check()` for `ends_at > starts_at`, `capacity >= 0`, `position >= 0`.
- **Indexes for what you query**: events by `(starts_at)`, `(category)`, `(price_cents)`, a `lower(title)`/trigram index for name search if needed; `agenda_items (user_id, position)`; `notifications (user_id, created_at desc)`; FK columns used in joins.
- Define `relations()` for relational queries; export types with `typeof table.$inferSelect` / `$inferInsert` (keep them **server-side**; the client uses Zod-derived DTO types).
- Workflow: edit schema → `pnpm db:generate` → **read the generated SQL** → `pnpm db:migrate` → commit schema + `drizzle/` together. Use `/db-migrate`.
- Transactions: `withTransaction` in `core/db/transaction.ts` wraps `db.transaction(...)`; repositories accept `tx?: DbOrTx`. Use `.for("update")` for the row you must lock (event capacity).
- One db client in `src/core/db/client.ts`, driver chosen by env: **node-postgres** (`drizzle-orm/node-postgres`, a pooled `pg.Pool`) locally; **Neon serverless** (`drizzle-orm/neon-serverless` for transaction support, `neon-http` has no interactive transactions: verify in current Drizzle/Neon docs) in production. Export the same `db` type from both. Reuse the client across hot reloads (`globalThis` cache in dev).
- Seed (`scripts/seed.ts`, BE-3): idempotent, realistic linked data: organizers + users with known dev passwords (dev only), events (free/paid, each type/category, one sold out, one past), sessions with CMS speaker slugs, registrations, an open single-choice poll and a multiple-choice poll with votes. Never run seed against production.

## MUST NOT
- **Never `drizzle-kit push`** (denied in settings); never edit an already-applied migration; never hand-edit `drizzle/meta`.
- No schema changes without a migration in the same commit/PR.
- No `select *` of wide rows to the client; no raw string-concatenated SQL. Use the query builder / `sql` template tag (parameterized). `sql.raw` is forbidden with any user input.
- No `float` money, no `timestamp` without time zone, no nullable columns "just in case".
- No query outside a repository (see `backend-architecture`).

## Procedure: new table (use `/design-table <feature>`)
1. List the entity's fields, relationships, who owns each row, what must be unique, what is queried/sorted/filtered.
2. Write `pgTable` with types, `notNull`, defaults, FKs + `onDelete`, unique/check constraints, indexes (the third `pgTable` argument).
3. Add `relations()`. Re-export from the barrel. 4. `pnpm db:generate`, read SQL. 5. `pnpm db:migrate` (asks permission). 6. Repository + integration test against the test DB.

## Example: agenda items with atomic reorder (AGD-1..3)
```ts
export const agendaItems = pgTable("agenda_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => eventSessions.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("agenda_user_session_uq").on(t.userId, t.sessionId),
  index("agenda_user_position_idx").on(t.userId, t.position),
  check("agenda_position_nonneg", sql`${t.position} >= 0`),
]);
```
Reorder = one transaction that rewrites positions for the user's items (validate that the submitted ids are exactly the user's current items). Avoid a unique `(user_id, position)` constraint unless you make it `DEFERRABLE` (Drizzle can't declare deferrable constraints directly: prefer no unique on position and rewrite all positions in one statement/transaction).

## Queries
- **Relational API** (`db.query.events.findFirst({ with: { sessions: true } })`) for "load an aggregate with children". **Query builder** (`db.select().from().where()`) for filters, joins, aggregates, pagination.
- **Avoid N+1**: never loop calling the repository per row; use `with`, `inArray`, or a join + group in one query.
- **Pagination**: `limit/offset` with a stable `orderBy` (add `id` as tie-breaker) + a `count(*)` query for `meta.total`. (BONUS-4 infinite scroll later: switch to keyset.)
- **Filtering/sorting** (DISC-2..4): build `and(...)` from optional conditions (`ilike(events.title, `%${q}%`)` with escaped wildcards, `eq`, `gte/lte`, `eq(price, 0)` for free). Sort whitelist maps `date|popularity|price` to columns; popularity = confirmed registration count (join + group or a denormalized counter).
- **Analytics** (BE-6): SQL aggregation, always scoped to the organizer's events:
  ```ts
  db.select({ day: sql<string>`date_trunc('day', ${payments.createdAt})`.as("day"),
              revenueCents: sql<number>`sum(${payments.amountCents})::int` })
    .from(payments).innerJoin(registrations, eq(...)).innerJoin(events, eq(...))
    .where(and(eq(events.organizerId, actor.id), gte(payments.createdAt, from), lte(payments.createdAt, to)))
    .groupBy(sql`day`).orderBy(sql`day`);
  ```
  Cast `sum/count` to `int` (Postgres returns bigint → string).

## Local vs production setup
- `docker-compose.yml`: `postgres:16` with a named volume, `POSTGRES_USER/PASSWORD/DB`, port 5432, plus a second DB `eventsphere_test` for integration tests (init script). `pnpm db:up`.
- `.env.local` (git-ignored): `DATABASE_URL=postgres://...@localhost:5432/eventsphere`. Production `DATABASE_URL` = Neon (pooled) in Vercel env. Validate via `core/config/env.ts`.
- Apply production migrations deliberately (CI/deploy step or a manual `pnpm db:migrate` with the prod URL after review), not through `push`.

## Common mistakes
- Forgetting the barrel export → drizzle-kit generates nothing.
- Unique constraints that block legitimate flows (e.g. unique `(user_id, event_id)` plus "re-register after cancel": **reuse the row** and set status back, don't insert a second row).
- `count(*)` returning a string; `timestamp` returned as `Date` and serialized inconsistently.
- Missing index on a column used in `orderBy` + `where` for the events list.
- Long transactions that wait on Stripe or CMS calls (do external calls outside the transaction).

## Final checklist
- [ ] Schema in the feature + barrel; migration generated, read, committed with the code.
- [ ] Constraints/indexes reflect the rules and the queries.
- [ ] FK `onDelete` chosen deliberately; money in cents; timestamptz.
- [ ] Repository only; `tx?` supported; no N+1; pagination stable.
- [ ] Analytics scoped to the organizer; casts applied.
- [ ] Seed updated for new tables; test DB migrated.
