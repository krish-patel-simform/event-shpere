---
description: Draft a pull request description into develop: requirement IDs, changes, migrations, screenshots to take, test evidence, checklist
argument-hint: [optional extra notes]
allowed-tools: Read, Grep, Glob, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git branch*), Bash(pnpm lint*), Bash(pnpm typecheck), Bash(pnpm test*)
---

Draft a PR description for the current branch into `develop` (or `main` only if I say this is a release). Extra notes from me: $ARGUMENTS

1. `git branch --show-current`, `git log develop..HEAD --oneline` (fall back to `main` if `develop` does not exist) and `git diff develop...HEAD --stat` plus the diff content. Identify requirement IDs from commit messages and the diff; check the catalog statuses.
2. Run `pnpm lint`, `pnpm typecheck` and relevant tests to collect **real** evidence (report failures honestly; do not claim green if it is not).
3. Output the PR title (`feat(<scope>): <IDs> <summary>`) and a description in this structure:
   - **Summary** (what and why, 2–4 sentences).
   - **Requirement IDs**: table ID | what changed | status after this PR.
   - **Changes by layer**: DB/migrations, repository/service, routes/API, Zod schemas, state/RTK Query, UI, tests, config/docs.
   - **Migrations**: files, tables/columns/indexes added or changed, destructive? data backfill? how to apply (`pnpm db:migrate`).
   - **API changes**: new/changed endpoints with auth + status codes; API collection updated? (`/api-collection`)
   - **Screenshots / recordings to attach** (list exactly which screens and states: loading, empty, error, mobile width).
   - **Test evidence**: commands run and results (unit/integration/E2E), new tests added, coverage notes.
   - **Security & data-integrity notes**: auth/ownership, rate limits, transactions, secrets.
   - **Risks / follow-ups** and anything not done.
   - **Checklist**: lint ✅, typecheck ✅, tests ✅, Zod on request + response, auth/ownership, migration committed, UI states, a11y, Sentry/logging, docs/catalog updated, no secrets.
4. Do not push or create the PR. Offer: "Want me to create it with `gh pr create`?" and only do so if I say yes (add the PR attribution line from Claude Code's guidance at the end of the body).
