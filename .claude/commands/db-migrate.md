---
description: Check schema changes, run drizzle-kit generate, show and explain the SQL, and apply it with drizzle-kit migrate only after I approve
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(pnpm db:generate), Bash(pnpm db:up), Bash(docker compose ps*)
---

Run the migration workflow from the `database-drizzle` skill. **Never use `drizzle-kit push`** and never edit an already-applied migration.

1. **Inspect**: `git status` / `git diff` on `src/**/db/schema.ts`, `src/core/db/schema.ts` (barrel) and `drizzle/`. Confirm every feature schema is exported from the barrel; if not, tell me and stop. If there are no schema changes, say so and stop.
2. **Environment**: confirm the local database is running (`docker compose ps`; if it is not, suggest `pnpm db:up`) and which `DATABASE_URL` target is configured **without reading any `.env*` file** (those are denied). If it may point at production, stop and warn me.
3. **Generate**: run `pnpm db:generate`. Report the new file(s) under `drizzle/`.
4. **Show and explain the SQL** statement by statement in plain words: what each does, what it locks or rewrites, whether it is destructive (`DROP`, type change, `NOT NULL` without default on existing rows), index/constraint effects, and whether data backfill is needed. Compare with what I intended; flag anything surprising (e.g. a rename generated as drop+create).
5. **Ask for approval**: "Apply this migration with `pnpm db:migrate`?" and wait. Only after I say yes run `pnpm db:migrate` (the permission prompt will also appear). Never run it against a production URL from here.
6. After applying: report success/failure, remind me to update the seed script and test factories if columns changed, and to commit the schema and `drizzle/` together (see `git-workflow`). If it failed, explain why and propose a fix; do not retry blindly or hand-edit the database.
