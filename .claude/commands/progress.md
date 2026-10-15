---
description: Read the catalog and the codebase; report status per module and week, risks for the current milestone, and what to do next and why
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git log*), Bash(git branch*)
---

Produce a **progress report** (read-only; do not modify files).

1. Read `docs/requirements-catalog.md` for the **claimed** status of every ID. Then inspect the codebase and `git log` for **evidence** (tables in `src/features/*/server/db/schema.ts`, migrations in `drizzle/`, routes in `src/app/api`, schemas, components, tests, CI config, Sentry/Serwist config). Note any mismatch between catalog status and reality (claimed Done without code/tests, or implemented but still `Todo`).
2. Determine the **current milestone week**: the lowest week that still has IDs not Done (ignore cross-cutting items for this step).
3. Report:
   - **Overview**: totals Done / In progress / Todo for mandatory IDs, and bonus untouched or not.
   - **Per week table**: week | modules | done/total | state (not started / in progress / done).
   - **Per module table**: module | done/total | notable gaps.
   - **Cross-cutting health** (STATE-1, ERR-*, MON-*, QUAL-1, BE-7, BE-8): per item, how well the existing code satisfies it so far.
   - **Catalog drift**: statuses to correct.
   - **Risks for the current milestone**: dependency gaps, integrations that need external setup (Stripe CLI, CMS space, Neon, Sentry, SonarCloud, Vercel), time-heavy items (PWA/Serwist with Turbopack, SSE on Vercel limits), testing debt. Weight by the spec's evaluation criteria (features 30%, quality 20%, testing 15%, integrations 15%, UI/UX 10%, docs 10%).
   - **Next steps**: the 3 most valuable things to do next, in order, each with the reason and the exact command to start it (`/explain-req ...` or `/explain-week ...`). Also say what should **not** be started yet (e.g. bonus features).
4. Keep it concise and honest; if the repo is still the bare create-next-app skeleton, say so and point to Week 1 setup.
