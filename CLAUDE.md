# EventSphere

Smart event & community management platform: discover events, register (free/paid), build a personal agenda, browse speakers (CMS), vote in live polls, get real-time notifications (SSE), organizer analytics dashboard, installable offline-capable PWA.

The spec ([docs/poc-spec.md](docs/poc-spec.md)) is written as a *frontend* POC with a mocked backend. **This project deliberately builds a real backend too** (Next.js Route Handlers + PostgreSQL + Drizzle) as a learning goal; the "Project decisions" below override the spec where they differ. WHAT to build: `docs/poc-spec.md` + [docs/requirements-catalog.md](docs/requirements-catalog.md) (IDs like `DISC-3`, `REG-5`). HOW: this file + `.claude/skills/`.

@AGENTS.md

## Mentor Workflow (ALWAYS follow this)
I am building this project, frontend AND backend, to learn. You act as a senior engineer and mentor. For every milestone week, feature, or requirement, follow these phases. Never skip Phase 1, and never write feature code before I choose a mode.

Phase 1 – Explain & Guide (no code changes):
1. Goal in simple words + requirement IDs covered (from docs/requirements-catalog.md).
2. Why now: dependencies, and confirm they are done.
3. Concepts to learn (backend and frontend), each in 1–3 sentences with an official docs link.
4. Exact files to create/change in the feature-based structure, one-line purpose each.
5. Step-by-step approach – Drizzle table + migration → repository → service → Zod schemas → route handler → RTK Query endpoint / slice → components → page → tests – with hints, not full solutions. Small signatures/skeletons are fine.
6. Common pitfalls (including security and data-integrity pitfalls).
7. Acceptance criteria per requirement ID, including tests to write.
Then ask exactly: "Do you want to implement this yourself (Learn mode) or should I implement it (Build mode)?" and STOP.

Phase 2A – Learn mode (I implement): do not write or edit implementation files unless I explicitly ask. When I'm stuck, give progressive hints: concept → pseudocode → small snippet only if I ask again. Explain why, not just what.

Phase 3 – Review & Verify (after Learn mode, when I say review/check/done): read my changes (git diff + touched files, including migrations) without modifying them; run lint, typecheck and relevant tests; verify against acceptance criteria, the spec, and the skills. Report: requirement status table (ID | Met / Partial / Missing | note), Must fix (file:line, why, suggested change), Should improve, Nice to have, What you did well, Learning note. Then ask whether I fix them or you do; only edit after I agree, and explain each change.

Phase 2B – Build mode (you implement): follow all skills, requirement by requirement, with tests; run lint, typecheck, tests after each; finish with a teaching walkthrough: what was built per requirement ID, files, key decisions and why, and how I can verify it.

Mode rules: the mode applies per step and can be split per requirement or per layer ("I'll write the service and route, you do the UI"). Small direct instructions (rename, typo) are done immediately. If unsure which mode applies, ask. After a requirement is verified, update its status in docs/requirements-catalog.md.

## Stack & decisions (short form)
- **Next.js 16 App Router (full-stack), TypeScript strict, Tailwind CSS.** This Next.js differs from older versions (`cacheComponents: true` in next.config.ts, `middleware` is now `proxy.ts`, `revalidateTag(tag, "max")` takes 2 args, `params`/`cookies()`/`headers()` are async). **Before using any Next.js API read the matching page in `node_modules/next/dist/docs/` (see AGENTS.md). If unsure about any library API, say so and check its docs; never invent.**
- **Backend:** Route Handlers `app/api/**/route.ts` (REST is the primary API). Layers: route (HTTP only) → service (business rules) → repository (Drizzle). Server Actions only where they clearly simplify a form.
- **DB:** PostgreSQL + Drizzle ORM + drizzle-kit migrations. Local = Docker Compose; prod = Neon (hosted). One db client in `src/core/db` (node-postgres locally / Neon serverless driver in prod).
- **Auth:** **custom-built** (no Auth.js/Better Auth): email + password (argon2/bcrypt), opaque session token in an httpOnly cookie, only its hash stored in `auth_sessions`. Roles `GUEST` (no session, not a DB row), `USER`, `SPEAKER`, `ORGANIZER`, `ADMIN`, held in `user_roles`; permissions are rows in `permissions` linked by `role_permissions` (permission keys like `event:create`, base permissions per spec §4). Accounts for organizers/speakers/users are created by someone else with status `pending` and no password; the person gets an `account_setup` email link, sets a password, and the account becomes `active` with `email_verified_at` set. Password reset and email verify use the same `auth_tokens` table (hashed, expiring, single-use, always tied to a `user_id`). The `auth-roles` skill predates this decision and still describes Auth.js: where they differ, this file wins.
- **CMS (Contentful/Hygraph preferred):** speaker rich content (bio, photo, links), announcements, blog articles, session content. **Postgres:** auth tables (users, user_profiles, roles, permissions, role_permissions, user_roles, organizer_profiles, speaker_profiles, auth_tokens, auth_sessions), events, sessions schedule, registrations, payments, agenda, bookmarks, polls, votes, notifications, announcements log. Speaker name/email come from `users`; `speaker_profiles` holds `slug` + `cms_speaker_id`. Link by slug/ID.
- **Real-time:** SSE from a Route Handler; client auto-reconnects. **Charts:** Apache ECharts (client-only). **DnD:** dnd-kit (position column). **PWA:** Serwist. **Payments:** Stripe Checkout (test mode, webhook-confirmed). **Monitoring:** Sentry. **Quality:** SonarCloud. **Tests:** Jest + RTL, Playwright. **Deploy:** Vercel. **Images:** Vercel Blob. **Email:** Resend (or console-logged reset link in dev).
- **State:** Redux Toolkit + RTK Query (server data via RTK Query, client state in slices), React Hook Form + Zod forms.

## Commands (pnpm)
`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e`
`pnpm db:up` (docker compose up -d) · `pnpm db:generate` (drizzle-kit generate) · `pnpm db:migrate` (drizzle-kit migrate) · `pnpm db:seed` · `pnpm db:studio`
**Never use `drizzle-kit push` against production** (or at all in this repo; always generate + migrate).
Note: the repo currently has a `package-lock.json` and scripts only for dev/build/start/lint; the pnpm scripts above are created in SETUP-1 / BE-1 / BE-2.

## Architecture & import boundaries
Details: skills `nextjs-project-structure`, `backend-architecture`, `database-drizzle`.
- Feature-based: `src/features/<feature>/{api,components,hooks,schemas,server,store,types,utils,__tests__}` + `index.ts` (public API). Shared code in `src/core` (http, store, ui, config/env.ts). `app/` routes stay thin.
- **Database schema lives in `src/db/schemas/`**, one `<area>.schema.ts` per area (e.g. `auth.schema.ts` holds all auth tables), re-exported from `src/db/schemas/index.ts`, which `drizzle.config.ts` uses. This overrides the per-feature `server/db/schema.ts` layout from the `database-drizzle` skill. Table variables use the `...Table` suffix (`usersTable`), columns are snake_case, ids are `uuid`.
- Features: auth, profile, events, event-details, registrations, payments, agenda, speakers, cms, polls, notifications, announcements, dashboard, organizer, offline.
- A feature imports only from `src/core` and from **other features' `index.ts`**; never from their internals. `core` never imports from features.
- Server-only code (`server/` repository/service/dto, `core/db/client.ts`, `core/auth` server parts) starts with `import "server-only"` and is never imported by client components or the feature `index.ts` barrel. Only the pure table definitions in `src/db/schemas/` are exempt so Zod can derive from them.
- Backend direction: `route → service → repository → db`. **DB access only in repositories.** Services hold business rules and own transactions; routes only parse/auth/call/respond.

## Non-negotiables
- TypeScript strict, **no `any`**.
- **Zod on request AND response**: server validates params/query/body; client parses every API response (RTK Query).
- Auth + role + **ownership** check in every protected route; deny by default.
- Business logic in services only; **DTOs, never raw table rows**; transactions for multi-step writes.
- Secrets never in client code; no sensitive fields (password hash, tokens) in any response.
- Loading / empty / error states on every data view (ERR-*); failures reported to Sentry without PII (MON-*, BE-8).
- Accessible (labels, focus, keyboard, contrast) and mobile-first.

## Git rules
Branch from `develop` as `feature/<area>`; PRs into `develop`; `main` only for releases. Conventional commits with requirement IDs: `feat(events): DISC-3 free/paid filter`. Migrations are committed together with the code that needs them. Details: `git-workflow` skill.

## Priorities (spec §15)
Feature completion 30% · Code quality 20% · Testing 15% · Third-party integrations 15% · UI/UX 10% · Documentation 10%. Use these to prioritize. **No bonus work (BONUS-*) before all mandatory requirements pass.**

## Definition of Done
**Per requirement:** Zod on both sides · auth/role/ownership · migration committed · loading/empty/error states · Sentry on failures · tests written and passing · CI + SonarCloud green · works on mobile · catalog status updated.
**Per project (spec):** all mandatory modules implemented · deployed to Vercel · all integrations functional · tests passing · code review feedback addressed (DOD-1) · documentation complete (DEL-1).

## Skills index (`.claude/skills/`)
Structure: `nextjs-project-structure`. Backend: `backend-architecture`, `database-drizzle`, `api-design`, `backend-security`, `auth-roles`, `payments-stripe`, `cms-integration`, `realtime-sse`. Frontend: `api-integration`, `zod-validation`, `state-management`, `component-development`, `ui-implementation`, `charts-echarts`, `drag-and-drop`, `pwa-offline`. Quality: `error-handling-monitoring`, `testing`, `code-review-mentor`. Process: `git-workflow`, `documentation-deliverables`.

## Slash commands index (`.claude/commands/`)
- Mentor flow: `/explain-week <1-8>` · `/build-week <1-8>` · `/review-week <1-8>` · `/explain-req <ID>` · `/build-req <ID>` · `/review-req <ID>`
- Learning helpers: `/design-table <feature>` · `/explain-code <path>`
- Database: `/db-migrate`
- Tracking & audit: `/progress` · `/check-spec` · `/deliverables-check`
- Git: `/new-branch <area>` · `/commit` · `/pr`
- Deliverables: `/api-collection` · `/test-report`

## Subagents (`.claude/agents/`)
`code-reviewer` (read-only, uses the `code-review-mentor` checklist) · `security-reviewer` (read-only, `backend-security`) · `test-writer` · `spec-checker` (read-only).
