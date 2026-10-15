---
name: zod-validation
description: Zod as the single source of truth in EventSphere: drizzle-zod base schemas derived from tables, separate request/response/form schemas via pick/omit/extend, z.infer types, query-param coercion, ISO dates, refine/superRefine (confirm password, time ranges, poll option limits), friendly error messages, and Zod-validated environment variables. Use when creating or changing any schema, form validation, API request/response shape, DTO type, or env config.
---

# Zod validation (single source of truth)

Serves: ERR-2, BE-1, BE-4, AUTH-1, AUTH-5, AUTH-7, DISC-3, DISC-4, POLL-4, DET-2, ORG-1, ORG-2, TEST-1.
Related: `database-drizzle`, `api-design`, `api-integration`, `ui-implementation` (forms), `backend-security`.

> Check the installed Zod major (this skill assumes **Zod 4**: `import { z } from "zod"`, `z.email()`, `z.uuid()`, `z.flattenError(err)`, `z.iso.datetime()`; in Zod 3 these differ) and how drizzle-zod is provided in the installed Drizzle version (`drizzle-zod` package vs built into `drizzle-orm`). Read the installed package docs before writing; do not guess.

## Purpose
Define each shape once; use it to validate on the server, parse on the client, type the code (`z.infer`), and drive form validation.

## MUST
- Location: `features/<f>/schemas/<name>.schema.ts`; export the schema **and** its type: `export const registerRequestSchema = ...; export type RegisterRequest = z.infer<typeof registerRequestSchema>`.
- Derive **base schemas from tables** (`createSelectSchema(events)`, `createInsertSchema(users)`) in `features/<f>/schemas/<name>.base.ts`, then **refine** them into request/response/form schemas in sibling files. This is allowed because `server/db/schema.ts` contains only pure table definitions (no connection, no `server-only`), so schema files can import it. **Never import repositories, the db client or anything else from `server/` into a schema file or client code.** If a derived schema measurably bloats the client bundle, declare the public DTO/form schema by hand instead and add a unit test asserting its keys are a subset of the table's columns.
- Separate shapes per purpose:
  - **Request** (body/query/params): `.pick/.omit` of the insert schema + server-owned fields removed (no `role`, `id`, `organizerId`).
  - **Response DTO** (`eventDtoSchema`): explicit public fields; dates as ISO strings (`z.iso.datetime()`); money as integer cents; no sensitive fields.
  - **Form** (`signupFormSchema = signupRequestSchema.extend({ confirmPassword })` + `.refine(passwordsMatch)`), friendly messages.
- Query params are strings: coerce (`z.coerce.number().int().min(1).default(1)`, `z.enum([...]).optional()`, boolean via `z.enum(["true","false"]).transform(...)`); cap `pageSize`; trim `q`.
- Cross-field rules with `.refine/.superRefine` and a `path`: `endsAt > startsAt` (DET-2, ORG-2), `confirmPassword`, poll `optionIds.length` between 1 and `maxChoices` (POLL-4: **also re-checked in the service** because it depends on the poll row), price ≥ 0, capacity ≥ 1.
- Messages: user-facing, specific ("Password must be at least 8 characters"), set at the schema so forms, API and tests share them.
- Server: parse with `safeParse`/`parse` through the route wrapper → `ValidationError` with `z.flattenError` details `{ fieldErrors, formErrors }`. Client: forms use `zodResolver(schema)` (React Hook Form); API responses use `parseOrThrow(schema, raw)`.
- **Env validation** (`src/core/config/env.ts`): `serverEnvSchema` (`DATABASE_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CMS_*`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `REVALIDATE_SECRET`, `SENTRY_*`) and `clientEnvSchema` (only `NEXT_PUBLIC_*`). Parse once at startup; export typed `env`; fail fast with a readable message. Server env file is `server-only`.

## MUST NOT
- No hand-written TypeScript interfaces duplicating a schema; always `z.infer`.
- No `z.any()`/`z.unknown()` in public schemas without a follow-up parse; no `as` casts after parsing.
- No trusting `schema.parse(await req.json())` without handling invalid JSON (wrapper returns 400).
- No password rules duplicated in two places that can drift (one exported `passwordSchema`).
- No schema file importing from React, Redux or the DB client.

## Example: event creation (ORG-1, ORG-2)
```ts
export const createEventRequestSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(EVENT_CATEGORIES),
  eventType: z.enum(["in_person", "online", "hybrid"]),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  priceCents: z.number().int().min(0), capacity: z.number().int().min(1),
}).refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { path: ["endsAt"], message: "End must be after start" });
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
```
Used by: route (`parse` body), RHF form (`zodResolver`), RTK mutation arg validation, and unit tests (valid/invalid table).

## Common mistakes
- Forgetting coercion (query `page="2"` fails `z.number()`).
- Using `z.date()` for JSON payloads (JSON has strings).
- `.refine` on an object, then trying `.pick/.extend` (refined objects need the base object for composition in some versions: keep a `base` schema and refine at the end).
- Accepting extra keys silently where it matters (use `.strict()` on request bodies for sensitive endpoints such as `/api/me`).
- Parsing env at import time in a module that is also bundled for the client.

## Final checklist
- [ ] One schema per shape; types via `z.infer`; no duplicated interfaces.
- [ ] Request, response and form schemas distinct and composed with pick/omit/extend.
- [ ] Coercion/defaults/limits for query params; ISO dates; cents for money.
- [ ] Cross-field rules via refine; service re-checks data-dependent rules.
- [ ] Env validated; server/client split.
- [ ] Unit tests for valid and invalid inputs (TEST-1).
