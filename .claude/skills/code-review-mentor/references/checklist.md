# EventSphere review checklist

Built from `CLAUDE.md` and the project skills. Use the sections that match what changed; each item names the skill that explains it. Answer **✅ / ❌ / n/a** with evidence (`file:line`).

## 1. Architecture & boundaries (`nextjs-project-structure`, `backend-architecture`)
- [ ] File lives in the right feature/core folder; naming follows conventions.
- [ ] Feature imports only `core` and other features' `index.ts` (or `server` barrel from server code); no deep imports; `core` doesn't import features.
- [ ] `app/` files are thin (no logic/queries); route → service → repository respected; **no DB access outside repositories**.
- [ ] `server/` files have `import "server-only"` (except pure `db/schema.ts`); client barrel exports nothing server-side.
- [ ] Business rules only in services; services take an `actor`, return DTOs, own transactions; repositories have optional `tx`.
- [ ] Server vs client component choice justified; `"use client"` at the smallest leaf.
- [ ] Next.js 16 specifics followed (`proxy.ts`, async `params/cookies/headers`, `revalidateTag(tag, "max")`, Cache Components rules); docs in `node_modules/next/dist/docs` consulted.

## 2. Zod on both sides (`zod-validation`, `api-integration`, `api-design`)
- [ ] Route parses params, query and body with Zod; invalid → 400 `VALIDATION_ERROR` with details.
- [ ] Route parses the **response** with a Zod schema; DTOs, never raw rows.
- [ ] Client parses every API response (`transformResponse`/`parseOrThrow`); request args validated before send.
- [ ] Types via `z.infer` (no duplicate interfaces, no `any`, no casts); query coercion/limits (`pageSize` cap); ISO dates; money in cents.
- [ ] Cross-field and data-dependent rules enforced server-side (e.g., poll `maxChoices`, end > start).

## 3. Auth, roles, ownership (`auth-roles`, `backend-security`)
- [ ] Route declares `auth`; permission map (spec §4) respected; role from session, not input.
- [ ] Ownership checked in the service (`/api/me/*`, organizer resources); foreign resources → 404.
- [ ] Rate limit on auth/vote/reset routes; webhook/cron/revalidate secrets verified (timing-safe).
- [ ] Negative tests: 401, 403, 404, 400, 429.

## 4. Security & secrets (`backend-security`)
- [ ] No secrets/tokens in code, client bundles, logs, fixtures; env via validated `core/config/env.ts`.
- [ ] No sensitive fields in DTOs (password hash, token hash, Stripe internals); generic error messages; no user enumeration.
- [ ] Passwords hashed correctly; reset tokens random, hashed, expiring, single-use.
- [ ] Parameterized queries only; `ilike` wildcards escaped; no `sql.raw` with input; uploads validated; CMS HTML sanitized.
- [ ] Stripe amount from DB; signature verified on raw body; idempotent processing.

## 5. Database & migrations (`database-drizzle`)
- [ ] Schema in the feature + barrel; **migration generated, read, committed with the code**; no `push`; applied migration not edited.
- [ ] Constraints carry the rules (unique, FK + `onDelete`, check); money in cents; `timestamptz`; enums.
- [ ] Indexes for filter/sort/join columns; no N+1; stable pagination order; aggregates cast and scoped to the organizer.
- [ ] Multi-step writes in a transaction with the right locking; no external calls inside long transactions.
- [ ] Seed and test factories updated.

## 6. Error handling & monitoring (`error-handling-monitoring`)
- [ ] Domain errors used and mapped; unexpected errors reach Sentry (server) with request id; expected 4xx don't.
- [ ] Client: API/network/contract failures handled and reported appropriately (MON-3); boundaries present.
- [ ] No empty catch; no PII in logs/Sentry; user messages are plain and actionable.

## 7. UI states & UX (`ui-implementation`, `component-development`)
- [ ] Loading, empty, error (with retry) and success states on every data view; forms have inline errors, pending state, server errors mapped.
- [ ] Mobile-first at 360/768/1280; no horizontal scroll; tokens used (dark-mode ready); `next/image`.
- [ ] Offline behavior considered (banner, disabled writes) where relevant.

## 8. Accessibility (`component-development`, `ui-implementation`, `drag-and-drop`)
- [ ] Semantic elements, labels, `alt`, focus visible/managed (modals), keyboard operable (incl. drag-and-drop alternative), `aria-live` for toasts/notifications, contrast ≥ 4.5:1, touch targets ≥ 44 px.

## 9. State management (`state-management`)
- [ ] State in the right home (RTK Query / slice / URL / RHF / local); no server data duplicated in slices; serializable; selectors for derived data; logout resets slices + API cache; per-request store.

## 10. Performance (`ui-implementation`, `charts-echarts`)
- [ ] Heavy libs (ECharts, dnd-kit, modals) lazy-loaded; server rendering used for public pages; images sized; no unbounded data; queries paginated/aggregated in SQL; no layout shift.

## 11. Tests (`testing`)
- [ ] New logic has tests at the right layer: service (fake repos), integration (DB constraints/transactions/routes), component/slice/utils, E2E when a spec journey changes.
- [ ] Tests assert behavior; deterministic; external services mocked; test DB guarded and reset; no `.only`/skips.
- [ ] Each acceptance criterion maps to at least one test or a documented manual check.

## 12. Naming, readability & Sonar (`CLAUDE.md`)
- [ ] Names reveal intent (domain words: registration, ballot, agenda item); consistent casing; no abbreviations that need a legend.
- [ ] Functions small and single-purpose; no duplicated blocks (Sonar duplication); no dead code/commented code/`console.log`; cognitive complexity reasonable; no `any`, no `!` to silence types.
- [ ] Comments explain *why*, not *what*.

## 13. Git & docs (`git-workflow`, `documentation-deliverables`)
- [ ] Conventional commits with requirement IDs; branch from `develop`; PR description complete.
- [ ] Catalog statuses updated only for verified IDs; docs/API collection updated when contracts changed.

## Report reminder
Requirement status table → Checks run → Must fix → Should improve → Nice to have → What you did well → Learning note → ask who applies fixes (no edits before the answer).
